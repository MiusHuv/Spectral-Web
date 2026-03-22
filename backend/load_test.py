#!/usr/bin/env python3
"""
Load testing script for the asteroid spectral web application.
Simulates concurrent users accessing the API endpoints.
"""
import asyncio
import aiohttp
import time
import statistics
import argparse
import json
from typing import List, Dict, Any
from dataclasses import dataclass
import random


@dataclass
class LoadTestConfig:
    """Configuration for load testing."""
    base_url: str = "http://localhost:5000"
    concurrent_users: int = 10
    requests_per_user: int = 20
    ramp_up_time: int = 5  # seconds
    test_duration: int = 60  # seconds
    endpoints: List[str] = None
    
    def __post_init__(self):
        if self.endpoints is None:
            self.endpoints = [
                "/api/classifications/bus_demeo/asteroids",
                "/api/classifications/tholen/asteroids",
                "/api/asteroids/1",
                "/api/asteroids/2/spectrum",
                "/api/spectra/wavelength-grid"
            ]


@dataclass
class RequestResult:
    """Result of a single request."""
    endpoint: str
    status_code: int
    response_time: float
    success: bool
    error: str = None
    timestamp: float = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()


class LoadTester:
    """Load testing class for the asteroid spectral API."""
    
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.results: List[RequestResult] = []
        self.start_time = None
        self.end_time = None
    
    async def make_request(self, session: aiohttp.ClientSession, endpoint: str) -> RequestResult:
        """Make a single HTTP request."""
        url = f"{self.config.base_url}{endpoint}"
        start_time = time.time()
        
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                await response.text()  # Read response body
                response_time = time.time() - start_time
                
                return RequestResult(
                    endpoint=endpoint,
                    status_code=response.status,
                    response_time=response_time,
                    success=200 <= response.status < 400,
                    timestamp=start_time
                )
        
        except asyncio.TimeoutError:
            return RequestResult(
                endpoint=endpoint,
                status_code=0,
                response_time=time.time() - start_time,
                success=False,
                error="Timeout",
                timestamp=start_time
            )
        
        except Exception as e:
            return RequestResult(
                endpoint=endpoint,
                status_code=0,
                response_time=time.time() - start_time,
                success=False,
                error=str(e),
                timestamp=start_time
            )
    
    async def user_simulation(self, user_id: int, session: aiohttp.ClientSession):
        """Simulate a single user's behavior."""
        print(f"User {user_id} starting...")
        
        for request_num in range(self.config.requests_per_user):
            # Random endpoint selection
            endpoint = random.choice(self.config.endpoints)
            
            # Make request
            result = await self.make_request(session, endpoint)
            self.results.append(result)
            
            # Random delay between requests (0.1 to 2 seconds)
            await asyncio.sleep(random.uniform(0.1, 2.0))
            
            # Check if test duration exceeded
            if self.start_time and (time.time() - self.start_time) > self.config.test_duration:
                break
        
        print(f"User {user_id} completed")
    
    async def run_load_test(self):
        """Run the load test."""
        print(f"Starting load test with {self.config.concurrent_users} concurrent users")
        print(f"Base URL: {self.config.base_url}")
        print(f"Test duration: {self.config.test_duration} seconds")
        print(f"Ramp-up time: {self.config.ramp_up_time} seconds")
        print("-" * 50)
        
        self.start_time = time.time()
        
        # Create HTTP session with connection pooling
        connector = aiohttp.TCPConnector(
            limit=self.config.concurrent_users * 2,
            limit_per_host=self.config.concurrent_users * 2
        )
        
        async with aiohttp.ClientSession(connector=connector) as session:
            # Create user tasks with ramp-up
            tasks = []
            ramp_up_delay = self.config.ramp_up_time / self.config.concurrent_users
            
            for user_id in range(self.config.concurrent_users):
                # Stagger user start times
                await asyncio.sleep(ramp_up_delay)
                task = asyncio.create_task(self.user_simulation(user_id, session))
                tasks.append(task)
            
            # Wait for all users to complete or timeout
            try:
                await asyncio.wait_for(
                    asyncio.gather(*tasks, return_exceptions=True),
                    timeout=self.config.test_duration + 30
                )
            except asyncio.TimeoutError:
                print("Test timed out, cancelling remaining tasks...")
                for task in tasks:
                    task.cancel()
        
        self.end_time = time.time()
        print(f"\nLoad test completed in {self.end_time - self.start_time:.2f} seconds")
    
    def analyze_results(self) -> Dict[str, Any]:
        """Analyze load test results."""
        if not self.results:
            return {"error": "No results to analyze"}
        
        # Basic statistics
        total_requests = len(self.results)
        successful_requests = sum(1 for r in self.results if r.success)
        failed_requests = total_requests - successful_requests
        success_rate = successful_requests / total_requests if total_requests > 0 else 0
        
        # Response time statistics
        response_times = [r.response_time for r in self.results if r.success]
        
        if response_times:
            avg_response_time = statistics.mean(response_times)
            median_response_time = statistics.median(response_times)
            min_response_time = min(response_times)
            max_response_time = max(response_times)
            p95_response_time = sorted(response_times)[int(0.95 * len(response_times))] if len(response_times) > 1 else response_times[0]
            p99_response_time = sorted(response_times)[int(0.99 * len(response_times))] if len(response_times) > 1 else response_times[0]
        else:
            avg_response_time = median_response_time = min_response_time = max_response_time = 0
            p95_response_time = p99_response_time = 0
        
        # Throughput calculation
        test_duration = self.end_time - self.start_time if self.start_time and self.end_time else 1
        requests_per_second = total_requests / test_duration
        
        # Error analysis
        error_counts = {}
        status_code_counts = {}
        
        for result in self.results:
            # Count status codes
            status_code_counts[result.status_code] = status_code_counts.get(result.status_code, 0) + 1
            
            # Count errors
            if result.error:
                error_counts[result.error] = error_counts.get(result.error, 0) + 1
        
        # Endpoint analysis
        endpoint_stats = {}
        for result in self.results:
            endpoint = result.endpoint
            if endpoint not in endpoint_stats:
                endpoint_stats[endpoint] = {
                    'total_requests': 0,
                    'successful_requests': 0,
                    'response_times': []
                }
            
            endpoint_stats[endpoint]['total_requests'] += 1
            if result.success:
                endpoint_stats[endpoint]['successful_requests'] += 1
                endpoint_stats[endpoint]['response_times'].append(result.response_time)
        
        # Calculate per-endpoint statistics
        for endpoint, stats in endpoint_stats.items():
            if stats['response_times']:
                stats['avg_response_time'] = statistics.mean(stats['response_times'])
                stats['success_rate'] = stats['successful_requests'] / stats['total_requests']
            else:
                stats['avg_response_time'] = 0
                stats['success_rate'] = 0
            
            # Remove raw response times to keep output clean
            del stats['response_times']
        
        return {
            'test_config': {
                'concurrent_users': self.config.concurrent_users,
                'requests_per_user': self.config.requests_per_user,
                'test_duration': test_duration,
                'base_url': self.config.base_url
            },
            'overall_stats': {
                'total_requests': total_requests,
                'successful_requests': successful_requests,
                'failed_requests': failed_requests,
                'success_rate': success_rate,
                'requests_per_second': requests_per_second
            },
            'response_time_stats': {
                'avg_response_time': avg_response_time,
                'median_response_time': median_response_time,
                'min_response_time': min_response_time,
                'max_response_time': max_response_time,
                'p95_response_time': p95_response_time,
                'p99_response_time': p99_response_time
            },
            'error_analysis': {
                'status_code_counts': status_code_counts,
                'error_counts': error_counts
            },
            'endpoint_stats': endpoint_stats
        }
    
    def print_results(self):
        """Print formatted test results."""
        analysis = self.analyze_results()
        
        if 'error' in analysis:
            print(f"Error: {analysis['error']}")
            return
        
        print("\n" + "=" * 60)
        print("LOAD TEST RESULTS")
        print("=" * 60)
        
        # Test configuration
        config = analysis['test_config']
        print(f"\nTest Configuration:")
        print(f"  Concurrent Users: {config['concurrent_users']}")
        print(f"  Requests per User: {config['requests_per_user']}")
        print(f"  Test Duration: {config['test_duration']:.2f} seconds")
        print(f"  Base URL: {config['base_url']}")
        
        # Overall statistics
        overall = analysis['overall_stats']
        print(f"\nOverall Statistics:")
        print(f"  Total Requests: {overall['total_requests']}")
        print(f"  Successful Requests: {overall['successful_requests']}")
        print(f"  Failed Requests: {overall['failed_requests']}")
        print(f"  Success Rate: {overall['success_rate']:.2%}")
        print(f"  Requests per Second: {overall['requests_per_second']:.2f}")
        
        # Response time statistics
        response_times = analysis['response_time_stats']
        print(f"\nResponse Time Statistics:")
        print(f"  Average: {response_times['avg_response_time']:.3f}s")
        print(f"  Median: {response_times['median_response_time']:.3f}s")
        print(f"  Min: {response_times['min_response_time']:.3f}s")
        print(f"  Max: {response_times['max_response_time']:.3f}s")
        print(f"  95th Percentile: {response_times['p95_response_time']:.3f}s")
        print(f"  99th Percentile: {response_times['p99_response_time']:.3f}s")
        
        # Status code distribution
        errors = analysis['error_analysis']
        print(f"\nStatus Code Distribution:")
        for status_code, count in sorted(errors['status_code_counts'].items()):
            print(f"  {status_code}: {count}")
        
        # Error analysis
        if errors['error_counts']:
            print(f"\nError Analysis:")
            for error, count in sorted(errors['error_counts'].items()):
                print(f"  {error}: {count}")
        
        # Per-endpoint statistics
        print(f"\nPer-Endpoint Statistics:")
        for endpoint, stats in analysis['endpoint_stats'].items():
            print(f"  {endpoint}:")
            print(f"    Requests: {stats['total_requests']}")
            print(f"    Success Rate: {stats['success_rate']:.2%}")
            print(f"    Avg Response Time: {stats['avg_response_time']:.3f}s")


async def main():
    """Main function for load testing."""
    parser = argparse.ArgumentParser(description="Load test the asteroid spectral API")
    parser.add_argument("--url", default="http://localhost:5000", help="Base URL for the API")
    parser.add_argument("--users", type=int, default=10, help="Number of concurrent users")
    parser.add_argument("--requests", type=int, default=20, help="Requests per user")
    parser.add_argument("--duration", type=int, default=60, help="Test duration in seconds")
    parser.add_argument("--ramp-up", type=int, default=5, help="Ramp-up time in seconds")
    parser.add_argument("--output", help="Output file for results (JSON format)")
    
    args = parser.parse_args()
    
    # Create configuration
    config = LoadTestConfig(
        base_url=args.url,
        concurrent_users=args.users,
        requests_per_user=args.requests,
        test_duration=args.duration,
        ramp_up_time=args.ramp_up
    )
    
    # Run load test
    tester = LoadTester(config)
    await tester.run_load_test()
    
    # Print results
    tester.print_results()
    
    # Save results to file if specified
    if args.output:
        analysis = tester.analyze_results()
        with open(args.output, 'w') as f:
            json.dump(analysis, f, indent=2)
        print(f"\nResults saved to {args.output}")


if __name__ == "__main__":
    asyncio.run(main())