"""
Locust load testing configuration for asteroid spectral web application
Run with: locust -f locustfile.py --host=http://localhost:5000
"""

from locust import HttpUser, task, between
import random
import json

class AsteroidSpectralUser(HttpUser):
    """Simulates a user browsing asteroid data"""
    
    wait_time = between(1, 3)  # Wait 1-3 seconds between requests
    
    def on_start(self):
        """Called when a user starts"""
        self.asteroid_ids = []
        self.classification_systems = ['bus_demeo', 'tholen']
        self.selected_asteroids = []
    
    @task(10)
    def browse_classifications(self):
        """Most common task - browse classifications"""
        response = self.client.get("/api/classifications")
        if response.status_code == 200:
            data = response.json()
            # Store available systems for later use
            if 'systems' in data:
                self.classification_systems = [system['name'] for system in data['systems']]
    
    @task(8)
    def view_asteroids_by_classification(self):
        """View asteroids in a specific classification"""
        system = random.choice(self.classification_systems)
        params = {
            'limit': random.choice([10, 20, 50]),
            'offset': random.randint(0, 100)
        }
        
        response = self.client.get(f"/api/classifications/{system}/asteroids", params=params)
        if response.status_code == 200:
            data = response.json()
            # Extract asteroid IDs for later use
            if 'classes' in data:
                for cls in data['classes']:
                    if 'asteroids' in cls:
                        for asteroid in cls['asteroids'][:5]:  # Take first 5
                            if 'id' in asteroid:
                                self.asteroid_ids.append(asteroid['id'])
    
    @task(6)
    def get_asteroid_details(self):
        """Get detailed information for selected asteroids"""
        if not self.asteroid_ids:
            return
        
        # Select 1-5 random asteroids
        selected = random.sample(self.asteroid_ids, min(random.randint(1, 5), len(self.asteroid_ids)))
        self.selected_asteroids = selected
        
        payload = {"asteroid_ids": selected}
        response = self.client.post("/api/asteroids/batch", json=payload)
        
        if response.status_code != 200:
            print(f"Asteroid details request failed: {response.status_code}")
    
    @task(5)
    def get_spectral_data(self):
        """Get spectral data for selected asteroids"""
        if not self.selected_asteroids:
            return
        
        payload = {"asteroid_ids": self.selected_asteroids}
        response = self.client.post("/api/spectra/batch", json=payload)
        
        if response.status_code != 200:
            print(f"Spectral data request failed: {response.status_code}")
    
    @task(2)
    def export_data(self):
        """Export asteroid data (less frequent operation)"""
        if not self.selected_asteroids:
            return
        
        export_format = random.choice(['json', 'csv'])
        payload = {
            "asteroid_ids": self.selected_asteroids[:3],  # Limit to 3 for export
            "format": export_format
        }
        
        response = self.client.post("/api/export/data", json=payload)
        
        if response.status_code != 200:
            print(f"Export request failed: {response.status_code}")
    
    @task(1)
    def export_spectrum(self):
        """Export spectral visualization (least frequent)"""
        if not self.selected_asteroids:
            return
        
        payload = {
            "asteroid_ids": self.selected_asteroids[:2],  # Limit to 2 for spectrum export
            "include_raw": random.choice([True, False])
        }
        
        response = self.client.post("/api/export/spectrum", json=payload)
        
        if response.status_code != 200:
            print(f"Spectrum export request failed: {response.status_code}")

class PowerUser(HttpUser):
    """Simulates a power user making more intensive requests"""
    
    wait_time = between(0.5, 2)  # Faster requests
    weight = 1  # Less common than regular users
    
    @task(5)
    def large_batch_requests(self):
        """Request data for many asteroids at once"""
        # Generate a list of asteroid IDs
        asteroid_ids = list(range(1, random.randint(10, 50)))
        
        payload = {"asteroid_ids": asteroid_ids}
        
        # Get asteroid details
        response = self.client.post("/api/asteroids/batch", json=payload)
        if response.status_code == 200:
            # If successful, also get spectral data
            self.client.post("/api/spectra/batch", json=payload)
    
    @task(3)
    def rapid_classification_browsing(self):
        """Rapidly browse through different classifications"""
        systems = ['bus_demeo', 'tholen']
        
        for system in systems:
            for offset in range(0, 100, 20):  # Browse multiple pages
                params = {'limit': 20, 'offset': offset}
                self.client.get(f"/api/classifications/{system}/asteroids", params=params)
    
    @task(2)
    def stress_export(self):
        """Stress test export functionality"""
        large_asteroid_list = list(range(1, 21))  # 20 asteroids
        
        payload = {
            "asteroid_ids": large_asteroid_list,
            "format": "json"
        }
        
        self.client.post("/api/export/data", json=payload)

class MobileUser(HttpUser):
    """Simulates mobile users with different usage patterns"""
    
    wait_time = between(2, 5)  # Slower, more deliberate usage
    weight = 2  # More common than power users
    
    @task(8)
    def simple_browsing(self):
        """Simple browsing pattern typical of mobile users"""
        # Get classifications
        self.client.get("/api/classifications")
        
        # Browse one classification
        system = random.choice(['bus_demeo', 'tholen'])
        params = {'limit': 10}  # Smaller page size for mobile
        self.client.get(f"/api/classifications/{system}/asteroids", params=params)
    
    @task(3)
    def select_few_asteroids(self):
        """Select and view details for just a few asteroids"""
        asteroid_ids = [random.randint(1, 100) for _ in range(random.randint(1, 3))]
        
        payload = {"asteroid_ids": asteroid_ids}
        self.client.post("/api/asteroids/batch", json=payload)
        self.client.post("/api/spectra/batch", json=payload)
    
    @task(1)
    def simple_export(self):
        """Simple export of small dataset"""
        asteroid_ids = [random.randint(1, 50)]
        
        payload = {
            "asteroid_ids": asteroid_ids,
            "format": "json"
        }
        
        self.client.post("/api/export/data", json=payload)

# Custom load test scenarios
class LoadTestScenarios:
    """Custom load test scenarios for specific testing"""
    
    @staticmethod
    def database_stress_test():
        """Stress test database connections"""
        class DatabaseStressUser(HttpUser):
            wait_time = between(0.1, 0.5)  # Very fast requests
            
            @task
            def rapid_database_queries(self):
                endpoints = [
                    "/api/classifications",
                    "/api/classifications/bus_demeo/asteroids",
                    "/api/classifications/tholen/asteroids"
                ]
                
                endpoint = random.choice(endpoints)
                self.client.get(endpoint)
        
        return DatabaseStressUser
    
    @staticmethod
    def memory_leak_test():
        """Test for memory leaks with large datasets"""
        class MemoryTestUser(HttpUser):
            wait_time = between(1, 2)
            
            @task
            def large_data_requests(self):
                # Request large batches repeatedly
                large_batch = list(range(1, 101))  # 100 asteroids
                
                payload = {"asteroid_ids": large_batch}
                self.client.post("/api/asteroids/batch", json=payload)
                self.client.post("/api/spectra/batch", json=payload)
        
        return MemoryTestUser

# Usage examples:
# Basic load test: locust -f locustfile.py --host=http://localhost:5000
# Specific user type: locust -f locustfile.py --host=http://localhost:5000 PowerUser
# Custom scenario: locust -f locustfile.py --host=http://localhost:5000 LoadTestScenarios.database_stress_test()