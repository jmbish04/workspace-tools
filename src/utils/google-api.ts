/**
 * @module google-api
 * @description This module provides a client for interacting with Google APIs.
 * It handles authentication, including OAuth 2.0 token caching and refreshing,
 * and provides methods for making authenticated API requests. It also includes
 * utility functions for common data transformations related to the API.
 */

import { Env } from "../types";
import { GoogleApiError, GoogleAuthToken } from "../types";

/**
 * @class GoogleApiClient
 * @description A client for making authenticated requests to Google Cloud Platform APIs.
 * It manages OAuth 2.0 tokens, including caching and refreshing, to ensure
 * that API calls are properly authorized.
 */
export class GoogleApiClient {
  private env: Env;
  private baseUrl = "https://www.googleapis.com";

  /**
   * Creates an instance of GoogleApiClient.
   * @param {Env} env The worker's environment object, containing secrets and KV bindings.
   */
  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Retrieves an authentication token.
   * It first checks for a cached token in KV storage. If the token is expired,
   * it attempts to refresh it. If no valid user token is available, it falls back
   * to using a service account token if configured.
   * @param {string} [user] An optional identifier for the user to retrieve a specific token.
   * @returns {Promise<GoogleAuthToken>} A promise that resolves to a valid auth token.
   * @throws {Error} If no valid authentication method is available.
   */
  async getAuthToken(user?: string): Promise<GoogleAuthToken> {
    const cacheKey = `google_token_${user || 'default'}`;
    console.log(`[GoogleApiClient] Getting auth token for cache key: ${cacheKey}`);

    const cached = await this.env.KV.get(cacheKey);

    if (cached) {
      const token: GoogleAuthToken = JSON.parse(cached);
      console.log("[GoogleApiClient] Found cached token.");

      // Check if token is still valid (with 5 minute buffer)
      if (token.expires_at > Date.now() + 300000) {
        console.log("[GoogleApiClient] Cached token is valid.");
        return token;
      }
      console.log("[GoogleApiClient] Cached token has expired.");

      // Try to refresh if we have a refresh token
      if (token.refresh_token) {
        console.log("[GoogleApiClient] Attempting to refresh token.");
        try {
          const refreshed = await this.refreshToken(token.refresh_token);
          console.log("[GoogleApiClient] Token refreshed successfully.");
          await this.env.KV.put(cacheKey, JSON.stringify(refreshed), {
            expirationTtl: 3600 // 1 hour
          });
          return refreshed;
        } catch (error) {
          console.error("[GoogleApiClient] Failed to refresh token:", error);
        }
      }
    } else {
      console.log("[GoogleApiClient] No token found in cache.");
    }

    // Fall back to service account if available
    if (this.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      console.log("[GoogleApiClient] Falling back to service account authentication.");
      return await this.getServiceAccountToken();
    }

    console.error("[GoogleApiClient] No valid authentication token available.");
    throw new Error("No valid authentication token available");
  }

  /**
   * Refreshes an expired OAuth 2.0 access token using a refresh token.
   * @private
   * @param {string} refreshToken The refresh token to use.
   * @returns {Promise<GoogleAuthToken>} A promise that resolves to a new, valid auth token.
   * @throws {Error} If the token refresh fails.
   */
  private async refreshToken(refreshToken: string): Promise<GoogleAuthToken> {
    console.log("[GoogleApiClient.refreshToken] Sending token refresh request.");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.env.GOOGLE_CLIENT_ID || '',
        client_secret: this.env.GOOGLE_CLIENT_SECRET || '',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GoogleApiClient.refreshToken] Failed to refresh token. Status: ${response.status}, Body: ${errorText}`);
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data: any = await response.json();
    console.log("[GoogleApiClient.refreshToken] Successfully obtained new access token.");
    return {
      access_token: data.access_token,
      refresh_token: refreshToken, // Keep the original refresh token
      expires_at: Date.now() + (data.expires_in * 1000),
      scope: data.scope || "",
    };
  }

  /**
   * Authenticates using a service account key by generating a JWT.
   * Note: This is a placeholder and requires a JWT signing implementation to be fully functional.
   * @private
   * @returns {Promise<GoogleAuthToken>} A promise that resolves to a service account auth token.
   * @throws {Error} If service account authentication is not fully implemented or fails.
   */
  private async getServiceAccountToken(): Promise<GoogleAuthToken> {
    console.log("[GoogleApiClient.getServiceAccountToken] Attempting service account authentication.");
    try {
      // Handle potential control character issues in JSON
      let serviceAccountJson = this.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      
      if (!serviceAccountJson) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
      }
      
      // Comprehensive control character sanitization
      serviceAccountJson = serviceAccountJson
        .replace(/\\n/g, '\n')           // Fix escaped newlines
        .replace(/\\r/g, '\r')           // Fix escaped carriage returns  
        .replace(/\\t/g, '\t')           // Fix escaped tabs
        .replace(/\\\\/g, '\\')          // Fix escaped backslashes
        .replace(/\\"/g, '"')            // Fix escaped quotes
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove remaining control characters
      
      const serviceAccount = JSON.parse(serviceAccountJson);

      // Create JWT for service account
      const header = {
        alg: "RS256",
        typ: "JWT",
      };

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: serviceAccount.client_email,
        scope: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.compose",
          "https://www.googleapis.com/auth/drive",
          "https://www.googleapis.com/auth/documents",
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/presentations",
          "https://www.googleapis.com/auth/script.projects"
        ].join(" "),
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      };

      // Sign JWT with private key using Web Crypto API
      console.log(`[GoogleApiClient.getServiceAccountToken] Signing JWT for service account: ${serviceAccount.client_email}`);
      const jwt = await this.signJWT(header, payload, serviceAccount.private_key);
      console.log(`[GoogleApiClient.getServiceAccountToken] JWT signed successfully`);
      
      // Exchange JWT for access token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`[GoogleApiClient.getServiceAccountToken] Token exchange failed with status ${tokenResponse.status}: ${errorText}`);
        
        // Try to parse error details
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = JSON.stringify(errorJson, null, 2);
        } catch (e) {
          // Keep original error text if not JSON
        }
        
        throw new Error(`Service account token exchange failed (${tokenResponse.status}): ${errorDetails}`);
      }

      const tokenData = await tokenResponse.json() as any;
      const token: GoogleAuthToken = {
        access_token: tokenData.access_token,
        expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
        scope: tokenData.scope || "",
      };

      return token;

    } catch (error) {
      console.error("[GoogleApiClient.getServiceAccountToken] Service account authentication failed:", error);
      
      // Provide more specific error message for JSON parsing issues
      if (error instanceof SyntaxError) {
        throw new Error(`Service account authentication failed: ${error.message}. Check that GOOGLE_SERVICE_ACCOUNT_KEY contains valid JSON.`);
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Service account authentication failed: ${errorMessage}`);
    }
  }

  /**
   * Signs a JWT using RSA-SHA256 with the Web Crypto API
   * @private
   * @param header JWT header
   * @param payload JWT payload
   * @param privateKey RSA private key in PEM format
   * @returns Promise<string> Signed JWT
   */
  private async signJWT(header: any, payload: any, privateKey: string): Promise<string> {
    try {
      console.log(`[GoogleApiClient.signJWT] Starting JWT signing process`);
      
      // Base64url encode header and payload
      const encodedHeader = this.base64urlEncode(JSON.stringify(header));
      const encodedPayload = this.base64urlEncode(JSON.stringify(payload));
      const unsignedToken = `${encodedHeader}.${encodedPayload}`;
      
      console.log(`[GoogleApiClient.signJWT] Encoded header and payload, unsigned token length: ${unsignedToken.length}`);

      // Import the private key
      console.log(`[GoogleApiClient.signJWT] Converting PEM to ArrayBuffer`);
      const keyData = this.pemToArrayBuffer(privateKey);
      console.log(`[GoogleApiClient.signJWT] Key data length: ${keyData.byteLength}`);
      
      console.log(`[GoogleApiClient.signJWT] Importing private key`);
      const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        keyData,
        {
          name: "RSASSA-PKCS1-v1_5",
          hash: "SHA-256",
        },
        false,
        ["sign"]
      );
      console.log(`[GoogleApiClient.signJWT] Private key imported successfully`);

      // Sign the token
      console.log(`[GoogleApiClient.signJWT] Signing token`);
      const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        new TextEncoder().encode(unsignedToken)
      );
      console.log(`[GoogleApiClient.signJWT] Token signed successfully, signature length: ${signature.byteLength}`);

      // Base64url encode the signature
      const encodedSignature = this.base64urlEncode(signature);
      const jwt = `${unsignedToken}.${encodedSignature}`;
      console.log(`[GoogleApiClient.signJWT] JWT created successfully, total length: ${jwt.length}`);
      
      return jwt;
    } catch (error) {
      console.error(`[GoogleApiClient.signJWT] JWT signing failed:`, error);
      throw new Error(`JWT signing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Converts PEM private key to ArrayBuffer
   * @private
   */
  private pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64Lines = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');
    
    const b64 = b64Lines;
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
  }

  /**
   * Base64url encode (URL-safe base64 without padding)
   * @private
   */
  private base64urlEncode(data: string | ArrayBuffer): string {
    let base64: string;
    
    if (typeof data === 'string') {
      base64 = btoa(data);
    } else {
      const bytes = new Uint8Array(data);
      const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
      base64 = btoa(binary);
    }
    
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Makes an authenticated request to a Google API endpoint.
   * @param {string} endpoint The API endpoint to call (e.g., "/drive/v3/files").
   * @param {RequestInit} [options={}] Optional request options (method, body, etc.).
   * @param {string} [user] The user identifier for retrieving the correct auth token.
   * @returns {Promise<any>} A promise that resolves to the JSON response from the API.
   * @throws {GoogleApiError} If the API returns a non-successful status code.
   */
  async makeRequest(endpoint: string, options: RequestInit = {}, user?: string): Promise<any> {
    const token = await this.getAuthToken(user);

    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`;
    console.log(`[GoogleApiClient.makeRequest] Making ${options.method || 'GET'} request to: ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        const responseText = await response.text();
        console.error(`[GoogleApiClient.makeRequest] API request failed with status ${response.status}, response:`, responseText);
        
        // Try to parse as JSON, but handle non-JSON responses
        if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
          errorData = JSON.parse(responseText);
        } else {
          // Handle non-JSON error responses (like "error code: 1042")
          errorData = {
            error: {
              message: responseText,
              code: response.status
            }
          };
        }
      } catch (parseError) {
        console.error(`[GoogleApiClient.makeRequest] Failed to parse error response:`, parseError);
        errorData = {
          error: {
            message: `HTTP ${response.status}: ${response.statusText}`,
            code: response.status
          }
        };
      }
      
      const error: GoogleApiError = {
        error: {
          code: response.status,
          message: errorData.error?.message || response.statusText,
          status: errorData.error?.status || "UNKNOWN_ERROR",
        },
      };
      console.error(`[GoogleApiClient.makeRequest] API request failed with status ${response.status}:`, JSON.stringify(error));
      throw error;
    }

    console.log(`[GoogleApiClient.makeRequest] API request to ${url} was successful (${response.status}).`);
    return await response.json();
  }

  /**
   * Uploads a file to Google Drive using a multipart request.
   * @param {string} endpoint The upload endpoint URL.
   * @param {any} metadata The metadata for the file.
   * @param {ArrayBuffer} file The file content as an ArrayBuffer.
   * @param {string} mimeType The MIME type of the file.
   * @param {string} [user] The user identifier for authentication.
   * @returns {Promise<any>} A promise that resolves to the JSON response from the upload API.
   * @throws {Error} If the upload fails.
   */
  async uploadFile(endpoint: string, metadata: any, file: ArrayBuffer, mimeType: string, user?: string): Promise<any> {
    console.log(`[GoogleApiClient.uploadFile] Starting multipart upload to: ${endpoint}`);
    const token = await this.getAuthToken(user);

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    let body = delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) + delimiter +
      `Content-Type: ${mimeType}\r\n\r\n`;

    const bodyArray = new TextEncoder().encode(body);
    const fileArray = new Uint8Array(file);
    const closeArray = new TextEncoder().encode(close_delim);

    const finalBody = new Uint8Array(bodyArray.length + fileArray.length + closeArray.length);
    finalBody.set(bodyArray, 0);
    finalBody.set(fileArray, bodyArray.length);
    finalBody.set(closeArray, bodyArray.length + fileArray.length);

    console.log(`[GoogleApiClient.uploadFile] Sending multipart request with file size: ${file.byteLength} bytes.`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token.access_token}`,
        "Content-Type": `multipart/related; boundary="${boundary}"`,
      },
      body: finalBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GoogleApiClient.uploadFile] Upload failed with status ${response.status}: ${errorText}`);
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    console.log(`[GoogleApiClient.uploadFile] Upload successful.`);
    return await response.json();
  }
}

/**
 * Decodes a base64url-encoded string into a UTF-8 string.
 * @param {string} str The base64url-encoded string.
 * @returns {string} The decoded string.
 */
export function decodeBase64Url(str: string): string {
  try {
    // Replace URL-safe characters and add padding if needed
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
      str += '=';
    }

    // Decode base64
    const decoded = atob(str);

    // Convert to UTF-8
    return decodeURIComponent(escape(decoded));
  } catch (error) {
    console.error("Failed to decode base64url:", error);
    return str;
  }
}

/**
 * Encodes a string into base64url format.
 * @param {string} str The string to encode.
 * @returns {string} The base64url-encoded string.
 */
export function encodeBase64Url(str: string): string {
  try {
    // Convert to base64
    const encoded = btoa(unescape(encodeURIComponent(str)));

    // Make URL-safe
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (error) {
    console.error("Failed to encode base64url:", error);
    return str;
  }
}

/**
 * Extracts common email headers (From, To, Subject, Date) from a Gmail message's headers array.
 * @param {Array<{ name: string; value: string }>} headers The array of header objects from the Gmail API.
 * @returns {{ from?: string; to?: string; subject?: string; date?: string; }} An object containing the extracted header values.
 */
export function extractEmailFromHeaders(headers: Array<{ name: string; value: string }>): {
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
} {
  const result: any = {};

  for (const header of headers) {
    const name = header.name.toLowerCase();
    if (name === 'from') result.from = header.value;
    else if (name === 'to') result.to = header.value;
    else if (name === 'subject') result.subject = header.value;
    else if (name === 'date') result.date = header.value;
  }

  return result;
}

/**
 * Safely parses a date string, returning the current date as a fallback.
 * @param {string} dateString The date string to parse.
 * @returns {Date} The parsed Date object, or the current date if parsing fails.
 */
export function parseGmailDate(dateString: string): Date {
  try {
    return new Date(dateString);
  } catch (error) {
    return new Date();
  }
}
