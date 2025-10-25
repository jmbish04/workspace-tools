import { JWT } from 'google-auth-library';
import { gmail_v1, google } from 'googleapis';

export interface ServiceAccountConfig {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export interface DomainDelegationConfig {
  serviceAccount: ServiceAccountConfig;
  delegatedUser: string; // The email address to impersonate
  scopes: string[];
}

/**
 * Gmail API client with domain-wide delegation support
 * Allows service accounts to impersonate users for email access
 */
export class GmailDomainDelegationClient {
  private auth: JWT;
  private gmail: gmail_v1.Gmail;

  constructor(config: DomainDelegationConfig) {
    this.auth = new JWT({
      email: config.serviceAccount.client_email,
      key: config.serviceAccount.private_key,
      scopes: config.scopes,
      subject: config.delegatedUser, // This enables impersonation
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.auth as any });
  }

  /**
   * Authenticate the service account
   */
  async authenticate(): Promise<void> {
    await this.auth.authorize();
  }

  /**
   * List messages with optional query
   */
  async listMessages(query?: string, maxResults: number = 100): Promise<gmail_v1.Schema$Message[]> {
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    return response.data.messages || [];
  }

  /**
   * Get full message details including headers and body
   */
  async getMessage(messageId: string): Promise<gmail_v1.Schema$Message | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return response.data;
    } catch (error) {
      console.error(`Failed to get message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Add label to message (e.g., for spam classification)
   */
  async addLabel(messageId: string, labelId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
  }

  /**
   * Remove label from message
   */
  async removeLabel(messageId: string, labelId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: [labelId],
      },
    });
  }

  /**
   * Create custom label for spam classification
   */
  async createLabel(name: string, color?: { backgroundColor: string; textColor: string }): Promise<string> {
    const response = await this.gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name,
        color,
        messageListVisibility: 'show',
        labelListVisibility: 'labelShow',
      },
    });

    return response.data.id!;
  }

  /**
   * Get all labels for the user
   */
  async getLabels(): Promise<gmail_v1.Schema$Label[]> {
    const response = await this.gmail.users.labels.list({
      userId: 'me',
    });

    return response.data.labels || [];
  }

  /**
   * Convert Gmail message to our EmailForAnalysis format
   */
  gmailToEmailForAnalysis(message: gmail_v1.Schema$Message): any {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    // Extract authentication results
    const authResults = getHeader('Authentication-Results');
    const parseAuth = (type: string) => {
      const match = authResults.match(new RegExp(`${type}=([^\\s;]+)`));
      return match ? { status: match[1] } : { status: 'none' };
    };

    return {
      messageId: message.id,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: [getHeader('To')],
      dateSent: new Date(parseInt(message.internalDate || '0')),
      body: this.extractMessageBody(message),
      headers: headers.reduce((acc, h) => {
        acc[h.name!] = h.value!;
        return acc;
      }, {} as Record<string, string>),
      labelIds: message.labelIds || [],
      threadId: message.threadId,
      authentication: {
        dkim: parseAuth('dkim'),
        spf: parseAuth('spf'),
        dmarc: parseAuth('dmarc'),
      },
    };
  }

  /**
   * Extract plain text body from Gmail message
   */
  private extractMessageBody(message: gmail_v1.Schema$Message): string {
    const extractFromPart = (part: gmail_v1.Schema$MessagePart): string => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8');
      }

      if (part.parts) {
        return part.parts.map(extractFromPart).join('\n');
      }

      return '';
    };

    if (message.payload) {
      return extractFromPart(message.payload);
    }

    return '';
  }
}

/**
 * Factory function to create Gmail client with domain delegation
 */
export function createGmailDomainDelegationClient(
  serviceAccountJson: string,
  delegatedUser: string,
  scopes: string[] = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
  ]
): GmailDomainDelegationClient {
  const serviceAccount: ServiceAccountConfig = JSON.parse(serviceAccountJson);

  return new GmailDomainDelegationClient({
    serviceAccount,
    delegatedUser,
    scopes,
  });
}

/**
 * Example usage for bulk email processing with domain delegation
 */
export async function processUserEmails(
  serviceAccountJson: string,
  userEmail: string,
  spamDetectionAgent: any,
  query: string = 'is:unread'
): Promise<void> {
  const gmailClient = createGmailDomainDelegationClient(serviceAccountJson, userEmail);

  await gmailClient.authenticate();

  // Get unread messages
  const messages = await gmailClient.listMessages(query, 50);

  console.log(`Processing ${messages.length} messages for ${userEmail}`);

  for (const message of messages) {
    const fullMessage = await gmailClient.getMessage(message.id!);
    if (!fullMessage) continue;

    const emailForAnalysis = gmailClient.gmailToEmailForAnalysis(fullMessage);

    // Run spam detection
    const spamResult = await spamDetectionAgent.analyzeEmail(emailForAnalysis);

    if (spamResult.isSpam) {
      console.log(`🚫 Spam detected: ${emailForAnalysis.subject}`);

      // Add spam label (you'd need to create this label first)
      // await gmailClient.addLabel(message.id!, 'SPAM_DETECTED');
    } else {
      console.log(`✅ Clean: ${emailForAnalysis.subject}`);
    }
  }
}
