#!/usr/bin/env python3
"""
Cloudflare Worker Control Interface - Fixed Version
Beautiful rich UI with working keyboard controls
"""

import asyncio
import json
import time
import sys
import os
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
        self.input_queue = asyncio.Queue()
        
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
            APIEndpoint("rag-stats", "RAG Statistics", "/gmail/rag-stats", "GET", "Analytics", description="View RAG processing statistics")
        ]

    def make_layout(self) -> Layout:
        """Create the main layout"""
        layout = Layout()
        
        layout.split(
            Layout(name="header", size=4),
            Layout(name="main"),  
            Layout(name="footer", size=4)
        )
        
        layout["main"].split_row(
            Layout(name="endpoints"),
            Layout(name="results")
        )
        
        # Update with content
        layout["header"].update(self.make_header())
        layout["endpoints"].update(self.make_endpoints_panel())
        layout["results"].update(self.make_results_panel())
        layout["footer"].update(self.make_footer())
        
        return layout

    def make_header(self) -> Panel:
        """Create the header panel"""
        return Panel(
            Text(f"🚀 CLOUDFLARE WORKER CONTROLLER", style="bold cyan", justify="center") +
            Text(f"\n{self.base_url}", style="dim", justify="center"),
            style="cyan",
            box=box.DOUBLE
        )

    def make_endpoints_panel(self) -> Panel:
        """Create the endpoints panel"""
        table = Table(box=box.SIMPLE)
        table.add_column("Key", style="bold yellow", width=4)
        table.add_column("Method", style="green", width=6)
        table.add_column("Endpoint", style="white", width=25)
        table.add_column("Status", style="cyan", width=6)
        
        for i, endpoint in enumerate(self.endpoints[:10]):
            key = str(i+1) if i < 9 else "0"
            
            # Get status from last results
            status = "⏸️"
            if endpoint.id in self.current_tests:
                status = "🔄"
            elif endpoint.id in self.last_results:
                result = self.last_results[endpoint.id]
                status = "✅" if result.get('success') else "❌"
                
            table.add_row(
                f"[{key}]",
                endpoint.method,
                endpoint.name[:23] + ("..." if len(endpoint.name) > 23 else ""),
                status
            )
        
        return Panel(table, title="📡 API Endpoints", box=box.ROUNDED)

    def make_results_panel(self) -> Panel:
        """Create the results panel"""
        if not self.last_results:
            help_text = Text()
            help_text.append("🎮 CONTROLS:\n\n", style="bold yellow")
            help_text.append("1-9,0", style="cyan bold")
            help_text.append(" - Test endpoints\n", style="white")
            help_text.append("a", style="yellow bold")  
            help_text.append(" - Test all endpoints\n", style="white")
            help_text.append("l", style="blue bold")
            help_text.append(" - View last results\n", style="white")
            help_text.append("s", style="magenta bold")
            help_text.append(" - System status\n", style="white")
            help_text.append("r", style="white bold")
            help_text.append(" - Refresh screen\n", style="white")
            help_text.append("q", style="red bold")
            help_text.append(" - Quit\n", style="white")
            
            return Panel(help_text, title="🎯 Ready", box=box.ROUNDED)
            
        # Show summary and recent results
        passed = sum(1 for r in self.last_results.values() if r.get('success'))
        total = len(self.last_results)
        
        table = Table(box=box.SIMPLE)
        table.add_column("Test", style="white", width=20)
        table.add_column("Result", style="cyan", width=8)
        table.add_column("Time", style="yellow", width=8)
        
        # Show latest 5 results
        latest = list(self.last_results.items())[-5:]
        for endpoint_id, result in latest:
            endpoint = next((e for e in self.endpoints if e.id == endpoint_id), None)
            if endpoint:
                status = "✅ Pass" if result.get('success') else "❌ Fail"
                elapsed = f"{result.get('elapsed_ms', 0)}ms"
                table.add_row(endpoint.name[:18], status, elapsed)
        
        summary = f"[bold]Summary:[/] [green]{passed}[/]/[white]{total}[/] passed"
        
        return Panel(
            Text(summary + "\n\n") + table,
            title="📊 Test Results", 
            box=box.ROUNDED
        )

    def make_footer(self) -> Panel:
        """Create the footer panel"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        status_text = "[green]🟢 Ready[/]" if self.running else "[red]🔴 Stopping[/]"
        
        footer_text = Text()
        footer_text.append(f"Status: {status_text} | Time: {timestamp} | ", style="dim")
        footer_text.append("Type a command and press Enter", style="bold white")
        
        return Panel(footer_text, box=box.ROUNDED, style="dim")

    async def test_endpoint(self, endpoint: APIEndpoint) -> Dict:
        """Test a single endpoint and return results"""
        url = f"{self.base_url}{endpoint.endpoint}"
        start_time = time.time()
        
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
                    return {'success': True, 'status_code': response.status_code, 'elapsed_ms': elapsed, 'data': data}
                except json.JSONDecodeError:
                    return {'success': True, 'status_code': response.status_code, 'elapsed_ms': elapsed, 'data': response.text}
            else:
                try:
                    error_data = response.json()
                except:
                    error_data = response.text
                return {'success': False, 'status_code': response.status_code, 'elapsed_ms': elapsed, 'error': error_data}
                
        except Exception as e:
            elapsed = int((time.time() - start_time) * 1000)
            return {'success': False, 'error': str(e), 'elapsed_ms': elapsed}

    def start_input_listener(self):
        """Start input listener in separate thread"""
        def input_worker():
            while self.running:
                try:
                    user_input = input()
                    asyncio.run_coroutine_threadsafe(
                        self.input_queue.put(user_input.strip().lower()), 
                        asyncio.get_event_loop()
                    )
                except (KeyboardInterrupt, EOFError):
                    asyncio.run_coroutine_threadsafe(
                        self.input_queue.put('q'), 
                        asyncio.get_event_loop()
                    )
                    break
                except:
                    pass
        
        thread = threading.Thread(target=input_worker, daemon=True)
        thread.start()

    async def run(self):
        """Run the main interface"""
        layout = self.make_layout()
        
        # Start input listener
        self.start_input_listener()
        
        with Live(layout, console=console, screen=True, redirect_stderr=False, refresh_per_second=10) as live:
            while self.running:
                # Update layout
                layout["header"].update(self.make_header())
                layout["endpoints"].update(self.make_endpoints_panel())
                layout["results"].update(self.make_results_panel())
                layout["footer"].update(self.make_footer())
                
                # Check for input
                try:
                    command = await asyncio.wait_for(self.input_queue.get(), timeout=0.1)
                    await self.handle_command(command, layout, live)
                except asyncio.TimeoutError:
                    pass
                
                await asyncio.sleep(0.1)

    async def handle_command(self, command: str, layout: Layout, live: Live):
        """Handle user commands"""
        if not command:
            return
            
        key = command[0]  # Take first character
        
        if key == 'q':
            self.running = False
            return
            
        elif key == 'a':
            await self.test_all_endpoints_live(layout, live)
            
        elif key == 's':
            await self.test_system_status(layout, live)
            
        elif key.isdigit():
            num = int(key)
            if num == 0:
                num = 10
            if 1 <= num <= len(self.endpoints):
                endpoint = self.endpoints[num-1]
                await self.test_single_endpoint(endpoint, layout, live)

    async def test_single_endpoint(self, endpoint: APIEndpoint, layout: Layout, live: Live):
        """Test single endpoint with live updates"""
        # Mark as testing
        self.current_tests[endpoint.id] = True
        
        # Update display
        layout["endpoints"].update(self.make_endpoints_panel())
        live.update(layout)
        
        # Run test
        result = await self.test_endpoint(endpoint)
        self.last_results[endpoint.id] = result
        
        # Remove from current tests
        if endpoint.id in self.current_tests:
            del self.current_tests[endpoint.id]

    async def test_all_endpoints_live(self, layout: Layout, live: Live):
        """Test all endpoints with live updates"""
        for endpoint in self.endpoints:
            await self.test_single_endpoint(endpoint, layout, live)
            await asyncio.sleep(0.3)

    async def test_system_status(self, layout: Layout, live: Live):
        """Test system status endpoints"""
        system_endpoints = [e for e in self.endpoints if e.category == "System"]
        for endpoint in system_endpoints:
            await self.test_single_endpoint(endpoint, layout, live)
            await asyncio.sleep(0.2)

    async def close(self):
        """Clean up resources"""
        await self.client.aclose()

async def main():
    # Check dependencies
    try:
        import httpx
    except ImportError as e:
        console.print(f"❌ Missing dependency: {e}", style="red")
        console.print("Install with: pip install httpx rich", style="yellow")
        sys.exit(1)
    
    # Get worker URL
    url = console.input(f"[cyan]Enter worker URL[/] [[cyan]{WORKER_URL}[/]]: ").strip() or WORKER_URL
    
    # Initialize controller
    controller = WorkerController(url)
    
    console.print("\n🚀 [bold green]Starting Worker Controller...[/]")
    console.print("[dim]Use keyboard shortcuts to control the worker[/]")
    console.print("[dim]Type commands and press Enter[/]\n")
    
    try:
        await controller.run()
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
