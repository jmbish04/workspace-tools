#!/usr/bin/env python3
"""
Cloudflare Worker Control Interface
Beautiful rich UI with reliable menu-driven controls
"""

import asyncio
import json
import time
import sys
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

import httpx
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.prompt import Prompt, IntPrompt, Confirm
from rich.syntax import Syntax
from rich import box
from rich.progress import track

# Configuration
WORKER_URL = "https://workspace-tools.hacolby.workers.dev"
console = Console()

@dataclass
class APIEndpoint:
    id: str
    name: str
    endpoint: str
    method: str
    category: str
    payload: Optional[Dict] = None
    description: str = ""

class WorkerController:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.client = httpx.AsyncClient(timeout=30.0)
        self.last_results = {}
        self.running = True
        
        # Define all available endpoints
        self.endpoints = [
            APIEndpoint("health", "System Health", "/health", "GET", "System", description="Check if the worker is running"),
            APIEndpoint("system-status", "System Status", "/system/status", "GET", "System", description="Get detailed system status"),
            APIEndpoint("system-activity", "Recent Activity", "/system/activity", "GET", "System", description="View recent system activities"),
            APIEndpoint("gmail-providers", "Gmail AI Providers", "/gmail/providers", "GET", "Gmail", description="List available AI providers"),
            APIEndpoint("gmail-search", "Gmail Search", "/gmail/search", "POST", "Gmail", 
                       {"query": "from:test@example.com", "maxResults": 5, "testMode": True}, "Search Gmail messages"),
            APIEndpoint("email-processing", "Email Processing", "/email-processing/process-emails", "POST", "Processing", 
                       {}, "Process recent emails"),
            APIEndpoint("thread-processor", "Thread Processing", "/thread-processor/process-message", "POST", "Processing",
                       {"messageId": f"test_msg_{int(time.time())}", "threadId": f"test_thread_{int(time.time())}", 
                        "from": "test@example.com", "body": "Test message for processing."}, "Process a specific message"),
            APIEndpoint("gmail-processing-status", "Gmail Processing Status", "/email-processing/processing-status", "GET", "Gmail", description="Check Gmail processing status"),
            APIEndpoint("gmail-recent", "Gmail Recent Messages", "/gmail/recent", "GET", "Gmail", description="Get recent Gmail messages"),
            APIEndpoint("rag-stats", "RAG Statistics", "/gmail/rag-stats", "GET", "Analytics", description="View RAG processing statistics"),
            APIEndpoint("sheets-test", "Sheets Test", "/sheets/test", "GET", "Sheets", description="Test Google Sheets integration"),
            APIEndpoint("drive-test", "Drive Test", "/drive/test", "GET", "Drive", description="Test Google Drive integration")
        ]

    def show_header(self):
        """Display beautiful header"""
        console.print()
        header_panel = Panel(
            Text("🚀 CLOUDFLARE WORKER CONTROLLER", style="bold cyan", justify="center") +
            Text(f"\n{self.base_url}", style="dim cyan", justify="center"),
            style="cyan",
            box=box.DOUBLE
        )
        console.print(header_panel)

    def show_endpoints_table(self):
        """Display endpoints in a beautiful table"""
        table = Table(title="📡 Available API Endpoints", box=box.ROUNDED, title_style="bold cyan")
        table.add_column("ID", style="bold yellow", width=3)
        table.add_column("Method", style="green", width=6)
        table.add_column("Name", style="white", width=22)
        table.add_column("Category", style="magenta", width=12)
        table.add_column("Status", style="cyan", width=8)
        
        for i, endpoint in enumerate(self.endpoints):
            # Get status from last results
            status_icon = "⏸️"
            if endpoint.id in self.last_results:
                result = self.last_results[endpoint.id]
                if result.get('success'):
                    elapsed = result.get('elapsed_ms', 0)
                    status_icon = f"✅ {elapsed}ms"
                else:
                    status_icon = "❌ Failed"
                    
            table.add_row(
                f"{i+1}",
                f"[bold]{endpoint.method}[/]",
                endpoint.name,
                endpoint.category,
                status_icon
            )
        
        console.print(table)

    def show_menu(self):
        """Display the main menu"""
        menu_panel = Panel(
            "[bold white]🎮 COMMANDS:[/]\n\n" +
            "[cyan]1-12[/] - Test specific endpoint\n" +
            "[yellow]a[/] - Test ALL endpoints\n" +
            "[blue]l[/] - Show last results details\n" +
            "[magenta]s[/] - System status check\n" +
            "[green]c[/] - Custom API call\n" +
            "[white]r[/] - Refresh display\n" +
            "[red]q[/] - Quit\n\n" +
            "[dim]Enter your choice and press Enter[/]",
            title="🎯 Menu",
            box=box.ROUNDED
        )
        console.print(menu_panel)

    def show_results_summary(self):
        """Show results summary if available"""
        if not self.last_results:
            return
            
        passed = sum(1 for r in self.last_results.values() if r.get('success'))
        total = len(self.last_results)
        
        summary_text = f"📊 [bold]Last Test Summary:[/] [green]{passed}[/]/[white]{total}[/] passed"
        
        # Show recent failures if any
        failures = [(k, v) for k, v in self.last_results.items() if not v.get('success')]
        if failures:
            summary_text += f"\n[red]❌ Recent failures:[/] "
            failure_names = [next((e.name for e in self.endpoints if e.id == fid), fid) for fid, _ in failures[:3]]
            summary_text += ", ".join(failure_names)
        
        console.print(Panel(summary_text, box=box.ROUNDED, style="dim"))

    async def test_endpoint(self, endpoint: APIEndpoint) -> Dict:
        """Test a single endpoint and return results"""
        url = f"{self.base_url}{endpoint.endpoint}"
        start_time = time.time()
        
        with console.status(f"[cyan]Testing {endpoint.name}...", spinner="dots"):
            try:
                if endpoint.method == "GET":
                    response = await self.client.get(url)
                elif endpoint.method == "POST":
                    response = await self.client.post(url, json=endpoint.payload or {})
                else:
                    raise ValueError(f"Unsupported method: {endpoint.method}")
                    
                elapsed = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        console.print(f"✅ [green]{endpoint.name}[/] - [white]{response.status_code}[/] in [yellow]{elapsed}ms[/]")
                        return {'success': True, 'status_code': response.status_code, 'elapsed_ms': elapsed, 'data': data}
                    except json.JSONDecodeError:
                        console.print(f"✅ [green]{endpoint.name}[/] - [white]{response.status_code}[/] in [yellow]{elapsed}ms[/] (non-JSON)")
                        return {'success': True, 'status_code': response.status_code, 'elapsed_ms': elapsed, 'data': response.text}
                else:
                    console.print(f"❌ [red]{endpoint.name}[/] - [red]{response.status_code}[/] in [yellow]{elapsed}ms[/]")
                    try:
                        error_data = response.json()
                    except:
                        error_data = response.text
                    return {'success': False, 'status_code': response.status_code, 'elapsed_ms': elapsed, 'error': error_data}
                    
            except Exception as e:
                elapsed = int((time.time() - start_time) * 1000)
                console.print(f"❌ [red]{endpoint.name}[/] - [red]Error: {str(e)}[/]")
                return {'success': False, 'error': str(e), 'elapsed_ms': elapsed}

    async def test_all_endpoints(self):
        """Test all endpoints with progress tracking"""
        console.print(f"\n🚀 [bold cyan]Testing all {len(self.endpoints)} endpoints...[/]\n")
        
        results = []
        for endpoint in track(self.endpoints, description="[cyan]Testing endpoints..."):
            result = await self.test_endpoint(endpoint)
            results.append(result)
            self.last_results[endpoint.id] = result
            await asyncio.sleep(0.2)  # Small delay between tests
        
        # Show summary
        passed = sum(1 for r in results if r.get('success'))
        failed = len(results) - passed
        
        summary_panel = Panel(
            f"[bold]Results Summary:[/]\n"
            f"[green]✅ Passed: {passed}[/]\n"
            f"[red]❌ Failed: {failed}[/]\n"
            f"[white]📊 Success Rate: {(passed/len(results)*100):.1f}%[/]",
            title="🏁 Test Complete",
            box=box.ROUNDED
        )
        console.print(summary_panel)

    def show_detailed_results(self):
        """Show detailed test results"""
        if not self.last_results:
            console.print("[yellow]No test results available yet[/]")
            return
            
        table = Table(title="📋 Detailed Test Results", box=box.ROUNDED)
        table.add_column("Endpoint", style="white", width=25)
        table.add_column("Method", style="green", width=6)
        table.add_column("Status", style="cyan", width=12)
        table.add_column("Time", style="yellow", width=8)
        table.add_column("Details", style="dim", width=30)
        
        for endpoint_id, result in self.last_results.items():
            endpoint = next((e for e in self.endpoints if e.id == endpoint_id), None)
            if not endpoint:
                continue
                
            status_code = result.get('status_code', 'N/A')
            if result.get('success'):
                status = f"✅ {status_code}"
                details = "Success"
                if 'data' in result and isinstance(result['data'], dict):
                    # Try to extract meaningful info from response
                    data = result['data']
                    if 'success' in data:
                        details = f"Success: {data.get('success', 'N/A')}"
                    elif 'status' in data:
                        details = f"Status: {data.get('status', 'N/A')}"
                    else:
                        details = f"Data keys: {list(data.keys())[:3]}"
            else:
                status = f"❌ {status_code}"
                error = str(result.get('error', 'Unknown error'))
                details = error[:25] + ("..." if len(error) > 25 else "")
            
            elapsed = f"{result.get('elapsed_ms', 0)}ms"
            
            table.add_row(
                endpoint.name,
                endpoint.method, 
                status,
                elapsed,
                details
            )
        
        console.print(table)

    async def system_status_check(self):
        """Quick system status check"""
        console.print("\n🔍 [bold cyan]System Status Check[/]\n")
        
        system_endpoints = [e for e in self.endpoints if e.category == "System"]
        for endpoint in system_endpoints:
            result = await self.test_endpoint(endpoint)
            self.last_results[endpoint.id] = result
            await asyncio.sleep(0.1)

    async def custom_api_call(self):
        """Make a custom API call"""
        console.print("\n🔧 [bold cyan]Custom API Call[/]")
        
        endpoint = Prompt.ask("Enter endpoint (e.g., /health)", default="/health")
        method = Prompt.ask("Enter method", choices=["GET", "POST", "PUT", "DELETE"], default="GET")
        
        payload = None
        if method in ["POST", "PUT"]:
            payload_input = Prompt.ask("Enter JSON payload (or press Enter for empty)", default="")
            if payload_input:
                try:
                    payload = json.loads(payload_input)
                except json.JSONDecodeError:
                    console.print("[red]❌ Invalid JSON, using empty payload[/]")
                    payload = {}

        # Create temporary endpoint
        temp_endpoint = APIEndpoint(
            id="custom",
            name=f"Custom {method}",
            endpoint=endpoint,
            method=method,
            category="Custom",
            payload=payload
        )
        
        result = await self.test_endpoint(temp_endpoint)
        self.last_results["custom"] = result
        
        # Show detailed result
        if result.get('success') and 'data' in result:
            console.print("\n📄 [bold]Response Data:[/]")
            try:
                formatted_json = json.dumps(result['data'], indent=2)
                syntax = Syntax(formatted_json, "json", theme="monokai")
                console.print(syntax)
            except:
                console.print(result['data'])

    def clear_screen(self):
        """Clear the screen"""
        console.clear()

    async def run_menu(self):
        """Run the main menu loop"""
        while self.running:
            self.clear_screen()
            self.show_header()
            self.show_endpoints_table()
            self.show_results_summary()
            self.show_menu()
            
            try:
                command = Prompt.ask("\n🎯 [bold white]Choose command[/]").strip().lower()
                
                if command == 'q':
                    self.running = False
                    console.print("\n👋 [bold blue]Goodbye![/]")
                    break
                    
                elif command == 'a':
                    await self.test_all_endpoints()
                    
                elif command == 'l':
                    self.clear_screen()
                    self.show_header()
                    self.show_detailed_results()
                    Prompt.ask("\nPress Enter to continue")
                    
                elif command == 's':
                    await self.system_status_check()
                    Prompt.ask("\nPress Enter to continue")
                    
                elif command == 'c':
                    await self.custom_api_call()
                    Prompt.ask("\nPress Enter to continue")
                    
                elif command == 'r':
                    # Just refresh by continuing the loop
                    continue
                    
                elif command.isdigit():
                    num = int(command)
                    if 1 <= num <= len(self.endpoints):
                        endpoint = self.endpoints[num-1]
                        console.print(f"\n🔄 Testing {endpoint.name}...")
                        result = await self.test_endpoint(endpoint)
                        self.last_results[endpoint.id] = result
                        
                        # Show result details
                        if result.get('success'):
                            console.print(f"\n🎉 [bold green]Success![/] Response time: [yellow]{result.get('elapsed_ms', 0)}ms[/]")
                        else:
                            console.print(f"\n💥 [bold red]Failed![/] Error: [red]{result.get('error', 'Unknown')}[/]")
                            
                        Prompt.ask("\nPress Enter to continue")
                    else:
                        console.print(f"[red]❌ Invalid endpoint number. Choose 1-{len(self.endpoints)}[/]")
                        Prompt.ask("Press Enter to continue")
                else:
                    console.print(f"[red]❌ Unknown command: {command}[/]")
                    console.print("[yellow]Valid commands: 1-12, a, l, s, c, r, q[/]")
                    Prompt.ask("Press Enter to continue")
                    
            except KeyboardInterrupt:
                self.running = False
                console.print("\n👋 [bold blue]Goodbye![/]")
                break
            except Exception as e:
                console.print(f"[red]❌ Error: {e}[/]")
                Prompt.ask("Press Enter to continue")

    async def close(self):
        """Clean up resources"""
        await self.client.aclose()

async def main():
    # Check dependencies
    try:
        import httpx
        from rich.console import Console
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Install with: pip install httpx rich")
        sys.exit(1)
    
    console.print("🚀 [bold green]Cloudflare Worker Controller[/]")
    console.print("[dim]Beautiful UI for testing your worker endpoints[/]\n")
    
    # Get worker URL
    url = Prompt.ask(
        "[cyan]Enter worker URL[/]", 
        default=WORKER_URL,
        show_default=True
    )
    
    # Initialize and run controller
    controller = WorkerController(url)
    
    try:
        await controller.run_menu()
    except KeyboardInterrupt:
        console.print("\n👋 [bold blue]Goodbye![/]")
    except Exception as e:
        console.print(f"\n❌ [bold red]Error: {e}[/]")
    finally:
        await controller.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console.print("\n👋 Goodbye!")
    except Exception as e:
        console.print(f"\n❌ Fatal error: {e}")
        sys.exit(1)
