#!/usr/bin/env python3
"""
Cloudflare Worker Control Interface
A comprehensive Python script with rich UI for controlling the Workspace Tools Worker
"""

import asyncio
import json
import time
import sys
import os
import signal
import threading
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

import httpx
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.layout import Layout
from rich.live import Live
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.syntax import Syntax
from rich import box
from rich.align import Align

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
        self.current_tests = {}
        self.key_pressed = None
        self.layout = Layout()
        self.setup_layout()
        
        # Define all available endpoints
        self.endpoints = [
            APIEndpoint(
                id="health",
                name="System Health",
                endpoint="/health",
                method="GET",
                category="System",
                description="Check if the worker is running"
            ),
            APIEndpoint(
                id="system-status",
                name="System Status", 
                endpoint="/system/status",
                method="GET",
                category="System",
                description="Get detailed system status"
            ),
            APIEndpoint(
                id="system-activity",
                name="Recent Activity",
                endpoint="/system/activity", 
                method="GET",
                category="System",
                description="View recent system activities"
            ),
            APIEndpoint(
                id="gmail-providers",
                name="Gmail AI Providers",
                endpoint="/gmail/providers",
                method="GET", 
                category="Gmail",
                description="List available AI providers"
            ),
            APIEndpoint(
                id="gmail-search",
                name="Gmail Search",
                endpoint="/gmail/search",
                method="POST",
                category="Gmail", 
                payload={
                    "query": "from:test@example.com",
                    "maxResults": 5,
                    "testMode": True
                },
                description="Search Gmail messages"
            ),
            APIEndpoint(
                id="email-processing",
                name="Email Processing",
                endpoint="/email-processing/process-emails",
                method="POST", 
                category="Processing",
                payload={},
                description="Process recent emails"
            ),
            APIEndpoint(
                id="thread-processor",
                name="Thread Processing", 
                endpoint="/thread-processor/process-message",
                method="POST",
                category="Processing",
                payload={
                    "messageId": f"test_msg_{int(time.time())}",
                    "threadId": f"test_thread_{int(time.time())}", 
                    "from": "test@example.com",
                    "body": "This is a test message for processing."
                },
                description="Process a specific message"
            ),
            APIEndpoint(
                id="gmail-processing-status",
                name="Gmail Processing Status",
                endpoint="/email-processing/processing-status",
                method="GET",
                category="Gmail",
                description="Check Gmail processing status"
            ),
            APIEndpoint(
                id="gmail-recent", 
                name="Gmail Recent Messages",
                endpoint="/gmail/recent",
                method="GET",
                category="Gmail",
                description="Get recent Gmail messages"
            ),
            APIEndpoint(
                id="rag-stats",
                name="RAG Statistics", 
                endpoint="/gmail/rag-stats",
                method="GET",
                category="Analytics",
                description="View RAG processing statistics"
            ),
            APIEndpoint(
                id="sheets-test",
                name="Sheets Test",
                endpoint="/sheets/test", 
                method="GET",
                category="Sheets",
                description="Test Google Sheets integration"
            ),
            APIEndpoint(
                id="drive-test", 
                name="Drive Test",
                endpoint="/drive/test",
                method="GET",
                category="Drive", 
                description="Test Google Drive integration"
            )
        ]

    def setup_layout(self):
        """Setup the rich layout structure"""
        self.layout.split(
            Layout(name="header", size=3),
            Layout(name="main"),
            Layout(name="footer", size=8)
        )
        
        self.layout["main"].split_row(
            Layout(name="endpoints"),
            Layout(name="results")
        )

    def make_header(self) -> Panel:
        """Create the header panel"""
        return Panel(
            f"🚀 [bold cyan]CLOUDFLARE WORKER CONTROLLER[/]\n"
            f"[dim]{self.base_url}[/]",
            style="cyan",
            box=box.DOUBLE
        )

    def make_endpoints_panel(self) -> Panel:
        """Create the endpoints panel"""
        table = Table(title="API Endpoints", box=box.ROUNDED)
        table.add_column("Key", style="bold yellow", width=4)
        table.add_column("Method", style="green", width=6) 
        table.add_column("Name", style="white", width=20)
        table.add_column("Status", style="cyan", width=8)
        
        for i, endpoint in enumerate(self.endpoints[:10]):
            key = str(i+1) if i < 9 else "0"
            
            # Get status from last results
            status = "⏸️"
            if endpoint.id in self.last_results:
                result = self.last_results[endpoint.id]
                status = "✅" if result.get('success') else "❌"
            elif endpoint.id in self.current_tests:
                status = "🔄"
                
            table.add_row(
                f"[{key}]",
                endpoint.method,
                endpoint.name[:18] + ("..." if len(endpoint.name) > 18 else ""),
                status
            )
        
        return Panel(table, title="Endpoints", box=box.ROUNDED)

    def make_results_panel(self) -> Panel:
        """Create the results panel"""
        if not self.last_results:
            return Panel(
                "[dim]No test results yet...[/]\n\n" +
                "[bold yellow]Commands:[/]\n" +
                "[cyan]1-9,0[/] - Test endpoints\n" +
                "[cyan]a[/] - Test all\n" +
                "[cyan]l[/] - Last results\n" +
                "[cyan]s[/] - System status\n" +
                "[cyan]c[/] - Custom call\n" +
                "[cyan]r[/] - Refresh\n" +
                "[cyan]q[/] - Quit",
                title="Results & Commands",
                box=box.ROUNDED
            )
            
        # Show summary of results
        passed = sum(1 for r in self.last_results.values() if r.get('success'))
        total = len(self.last_results)
        
        results_text = f"[bold]Summary:[/] [green]{passed}[/]/[white]{total}[/] passed\n\n"
        
        # Show latest results (last 3)
        latest = list(self.last_results.items())[-3:]
        for endpoint_id, result in latest:
            endpoint = next((e for e in self.endpoints if e.id == endpoint_id), None)
            if endpoint:
                status_icon = "✅" if result.get('success') else "❌"
                elapsed = result.get('elapsed_ms', 0)
                results_text += f"{status_icon} {endpoint.name}: {elapsed}ms\n"
        
        return Panel(
            results_text + f"\n[dim]Press 'l' for detailed results[/]",
            title="Recent Results",
            box=box.ROUNDED
        )

    def make_footer(self) -> Panel:
        """Create the footer panel"""
        return Panel(
            "[bold white]Commands:[/] " +
            "[cyan]1-9,0[/] Test • " +
            "[yellow]a[/] All • " + 
            "[blue]l[/] Results • " +
            "[magenta]s[/] Status • " +
            "[green]c[/] Custom • " +
            "[white]r[/] Refresh • " +
            "[red]q[/] Quit\n" +
            f"[dim]Last update: {datetime.now().strftime('%H:%M:%S')}[/]",
            box=box.ROUNDED,
            style="dim"
        )

    def update_layout(self):
        """Update all layout panels"""
        self.layout["header"].update(self.make_header())
        self.layout["endpoints"].update(self.make_endpoints_panel())
        self.layout["results"].update(self.make_results_panel())
        self.layout["footer"].update(self.make_footer())

    def start_keyboard_listener(self):
        """Start keyboard input in separate thread"""
        def listen_for_keys():
            while self.running:
                try:
                    key = input().strip().lower()
                    if key:
                        self.key_pressed = key[0]  # Take first character
                except (KeyboardInterrupt, EOFError):
                    self.key_pressed = 'q'
                except:
                    pass
        
        keyboard_thread = threading.Thread(target=listen_for_keys, daemon=True)
        keyboard_thread.start()

    def clear_screen(self):
        os.system('cls' if os.name == 'nt' else 'clear')

    async def run(self):
        """Run the main interface with rich live updates"""
        self.start_keyboard_listener()
        
        with Live(self.layout, console=console, screen=True, redirect_stderr=False) as live:
            while self.running:
                self.update_layout()
                live.update(self.layout)
                
                # Check for key press
                if self.key_pressed:
                    key = self.key_pressed
                    self.key_pressed = None
                    
                    # Handle the key press
                    if key == 'q':
                        self.running = False
                        break
                    else:
                        await self.handle_command(key, live)
                
                await asyncio.sleep(0.1)

    async def handle_command(self, key: str, live):
        """Handle user commands in rich interface"""
        if key == 'r':
            # Just refresh - layout will update automatically
            pass
            
        elif key == 'a':
            await self.test_all_endpoints_rich(live)
            
        elif key == 'l':
            await self.show_detailed_results(live)
            
        elif key == 's':
            await self.show_system_status_rich(live)
            
        elif key == 'c':
            await self.custom_api_call_rich(live)
            
        elif key.isdigit():
            num = int(key)
            if num == 0:
                num = 10
            
            if 1 <= num <= len(self.endpoints):
                endpoint = self.endpoints[num-1]
                await self.test_single_endpoint_rich(endpoint, live)

    async def test_endpoint(self, endpoint: APIEndpoint) -> Dict:
        """Test a single endpoint and return results"""
        url = f"{self.base_url}{endpoint.endpoint}"
        
        start_time = time.time()
        
        try:
            print(f"{Colors.BLUE}🔄 Testing {endpoint.name}...{Colors.RESET}")
            
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
                    print(f"{Colors.GREEN}✅ {endpoint.name} passed ({response.status_code} in {elapsed}ms){Colors.RESET}")
                    return {
                        'success': True,
                        'status_code': response.status_code,
                        'elapsed_ms': elapsed,
                        'data': data,
                        'endpoint': endpoint.name
                    }
                except json.JSONDecodeError:
                    print(f"{Colors.GREEN}✅ {endpoint.name} passed ({response.status_code} in {elapsed}ms) - Non-JSON response{Colors.RESET}")
                    return {
                        'success': True,
                        'status_code': response.status_code,
                        'elapsed_ms': elapsed,
                        'data': response.text,
                        'endpoint': endpoint.name
                    }
            else:
                print(f"{Colors.RED}❌ {endpoint.name} failed ({response.status_code} in {elapsed}ms){Colors.RESET}")
                try:
                    error_data = response.json()
                except:
                    error_data = response.text
                    
                return {
                    'success': False,
                    'status_code': response.status_code,
                    'elapsed_ms': elapsed,
                    'error': error_data,
                    'endpoint': endpoint.name
                }
                
        except Exception as e:
            elapsed = int((time.time() - start_time) * 1000)
            print(f"{Colors.RED}❌ {endpoint.name} error: {str(e)}{Colors.RESET}")
            return {
                'success': False,
                'error': str(e),
                'elapsed_ms': elapsed,
                'endpoint': endpoint.name
            }

    async def test_all_endpoints(self):
        """Test all endpoints sequentially"""
        print(f"\n{Colors.BOLD}{Colors.CYAN}🚀 Testing all {len(self.endpoints)} endpoints...{Colors.RESET}\n")
        
        results = []
        passed = 0
        failed = 0
        
        for endpoint in self.endpoints:
            result = await self.test_endpoint(endpoint)
            results.append(result)
            self.last_results[endpoint.id] = result
            
            if result.get('success'):
                passed += 1
            else:
                failed += 1
                
            # Small delay between tests
            await asyncio.sleep(0.1)
        
        print(f"\n{Colors.BOLD}📊 Results: {Colors.GREEN}{passed} passed{Colors.RESET}, {Colors.RED}{failed} failed{Colors.RESET}")
        return results

    def show_last_results(self):
        """Display the last test results"""
        if not self.last_results:
            print(f"{Colors.YELLOW}No test results available yet{Colors.RESET}")
            return
            
        print(f"\n{Colors.BOLD}{Colors.WHITE}Last Test Results:{Colors.RESET}")
        
        for endpoint_id, result in self.last_results.items():
            endpoint = next((e for e in self.endpoints if e.id == endpoint_id), None)
            if not endpoint:
                continue
                
            status = f"{Colors.GREEN}✅" if result.get('success') else f"{Colors.RED}❌"
            elapsed = result.get('elapsed_ms', 0)
            status_code = result.get('status_code', 'N/A')
            
            print(f"{status} {endpoint.name}: {status_code} in {elapsed}ms{Colors.RESET}")
            
            if result.get('success') and 'data' in result:
                # Show truncated data
                data_str = json.dumps(result['data'], indent=2)[:200]
                if len(data_str) == 200:
                    data_str += "..."
                print(f"   {Colors.WHITE}{data_str}{Colors.RESET}")
            elif result.get('error'):
                error_str = str(result['error'])[:150]
                print(f"   {Colors.RED}Error: {error_str}{Colors.RESET}")
            print()

    async def custom_api_call(self):
        """Allow user to make custom API calls"""
        print(f"\n{Colors.BOLD}{Colors.CYAN}Custom API Call{Colors.RESET}")
        
        endpoint = input(f"{Colors.WHITE}Endpoint (e.g., /health): {Colors.RESET}")
        if not endpoint:
            return
            
        method = input(f"{Colors.WHITE}Method [GET]: {Colors.RESET}").upper() or "GET"
        
        payload = None
        if method in ["POST", "PUT", "PATCH"]:
            payload_str = input(f"{Colors.WHITE}Payload (JSON, or press Enter for empty): {Colors.RESET}")
            if payload_str:
                try:
                    payload = json.loads(payload_str)
                except json.JSONDecodeError:
                    print(f"{Colors.RED}❌ Invalid JSON payload{Colors.RESET}")
                    return

        # Create custom endpoint
        custom_endpoint = APIEndpoint(
            id="custom",
            name=f"Custom {method}",
            endpoint=endpoint,
            method=method,
            category="Custom",
            payload=payload,
            description="User-defined API call"
        )
        
        result = await self.test_endpoint(custom_endpoint)
        self.last_results["custom"] = result
        
        if result.get('success'):
            print(f"\n{Colors.GREEN}✅ Success!{Colors.RESET}")
            if 'data' in result:
                data_json = json.dumps(result['data'], indent=2)
                print(f"{Colors.WHITE}{data_json}{Colors.RESET}")
        else:
            print(f"\n{Colors.RED}❌ Failed!{Colors.RESET}")
            if 'error' in result:
                print(f"{Colors.RED}{result['error']}{Colors.RESET}")

    async def show_system_status(self):
        """Show comprehensive system status"""
        print(f"\n{Colors.BOLD}{Colors.CYAN}🔍 System Status Check{Colors.RESET}\n")
        
        # Test key endpoints for status
        status_endpoints = [
            next(e for e in self.endpoints if e.id == "health"),
            next(e for e in self.endpoints if e.id == "system-status"), 
            next(e for e in self.endpoints if e.id == "gmail-providers")
        ]
        
        for endpoint in status_endpoints:
            await self.test_endpoint(endpoint)
            await asyncio.sleep(0.2)

    def get_input_non_blocking(self):
        """Get keyboard input without blocking"""
        if os.name == 'nt':  # Windows
            import msvcrt
            if msvcrt.kbhit():
                return msvcrt.getch().decode('utf-8').lower()
        else:  # Unix/Linux/macOS
            import select
            if select.select([sys.stdin], [], [], 0.1)[0]:
                return sys.stdin.read(1).lower()
        return None

    def print_interface(self):
        """Print the main interface"""
        self.clear_screen()
        self.print_header()
        self.print_endpoints()
        self.print_menu()
        
        # Show quick stats if we have results
        if self.last_results:
            passed = sum(1 for r in self.last_results.values() if r.get('success'))
            total = len(self.last_results)
            print(f"{Colors.BOLD}Last Tests: {Colors.GREEN}{passed}/{total} passed{Colors.RESET}")
        
        print(f"{Colors.BOLD}{Colors.WHITE}Ready for commands!{Colors.RESET}")

    def clear_screen(self):
        os.system('cls' if os.name == 'nt' else 'clear')

    def print_header(self):
        print(f"""
{Colors.BOLD}{Colors.CYAN}╔══════════════════════════════════════════════════════════════════════════╗{Colors.RESET}
{Colors.BOLD}{Colors.CYAN}║                    🚀 CLOUDFLARE WORKER CONTROLLER                     ║{Colors.RESET}
{Colors.BOLD}{Colors.CYAN}║                         {self.base_url:<40} ║{Colors.RESET}
{Colors.BOLD}{Colors.CYAN}╚══════════════════════════════════════════════════════════════════════════╝{Colors.RESET}""")

    async def run_interactive(self):
        """Run the interactive interface with simple input handling"""
        
        try:
            while self.running:
                self.print_interface()
                
                # Use simple blocking input - more reliable
                try:
                    print(f"\n{Colors.BOLD}{Colors.WHITE}Enter command: {Colors.RESET}", end='', flush=True)
                    user_input = input().strip().lower()
                    
                    if user_input:
                        await self.handle_keypress(user_input[0])  # Take first character
                        
                except KeyboardInterrupt:
                    self.running = False
                except EOFError:
                    self.running = False
                except Exception as e:
                    print(f"{Colors.RED}Input error: {e}{Colors.RESET}")
                    await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            pass

    async def handle_keypress(self, key: str):
        """Handle user commands"""
        
        if key == 'q':
            self.running = False
            print(f"\n{Colors.BOLD}{Colors.BLUE}👋 Goodbye!{Colors.RESET}")
            return
            
        elif key == 'r':
            self.print_interface()
            
        elif key == 'a':
            print(f"\n{Colors.BOLD}Testing all endpoints...{Colors.RESET}")
            await self.test_all_endpoints()
            
        elif key == 'l':
            self.clear_screen()
            self.print_header()
            self.show_last_results()
            
        elif key == 's':
            await self.show_system_status()
            
        elif key == 'c':
            self.clear_screen()
            self.print_header()
            await self.custom_api_call()
            
        elif key.isdigit():
            num = int(key)
            if num == 0:
                num = 10
            
            if 1 <= num <= len(self.endpoints):
                endpoint = self.endpoints[num-1]
                print(f"\n{Colors.BOLD}Testing {endpoint.name}...{Colors.RESET}")
                result = await self.test_endpoint(endpoint)
                self.last_results[endpoint.id] = result
                
                # Show detailed result
                if result.get('success'):
                    print(f"\n{Colors.GREEN}✅ Success!{Colors.RESET}")
                    if 'data' in result:
                        data_json = json.dumps(result['data'], indent=2)[:500]
                        if len(data_json) == 500:
                            data_json += "..."
                        print(f"{Colors.WHITE}{data_json}{Colors.RESET}")
                else:
                    print(f"\n{Colors.RED}❌ Failed!{Colors.RESET}")
                    if 'error' in result:
                        print(f"{Colors.RED}{result['error']}{Colors.RESET}")
        else:
            print(f"{Colors.RED}Unknown command: {key}{Colors.RESET}")
            print(f"{Colors.WHITE}Use commands: 1-9,0,a,l,s,c,r,q{Colors.RESET}")

    async def close(self):
        """Clean up resources"""
        await self.client.aclose()

def setup_signal_handlers(controller):
    """Set up signal handlers for graceful shutdown"""
    def signal_handler(signum, frame):
        controller.running = False
        print(f"\n{Colors.BOLD}{Colors.BLUE}👋 Shutting down gracefully...{Colors.RESET}")
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

async def main():
    # Check dependencies first
    try:
        import httpx
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Install with: pip install httpx rich")
        sys.exit(1)
    
    # Get worker URL
    url = input(f"Enter worker URL [{WORKER_URL}]: ").strip() or WORKER_URL
    
    # Initialize controller
    controller = WorkerController(url)
    setup_signal_handlers(controller)
    
    print(f"\n{Colors.BOLD}{Colors.GREEN}🚀 Starting Worker Controller...{Colors.RESET}")
    print(f"{Colors.WHITE}Use keyboard shortcuts to control the worker{Colors.RESET}")
    print(f"{Colors.WHITE}Press 'q' to quit, 'r' to refresh{Colors.RESET}\n")
    
    try:
        await controller.run_interactive()
    except Exception as e:
        print(f"\n{Colors.RED}❌ Error: {e}{Colors.RESET}")
    finally:
        await controller.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{Colors.BOLD}{Colors.BLUE}👋 Goodbye!{Colors.RESET}")
    except Exception as e:
        print(f"\n{Colors.RED}❌ Fatal error: {e}{Colors.RESET}")
        sys.exit(1)