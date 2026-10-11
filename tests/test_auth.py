import unittest
from backend.app import is_lan_ip, app
from backend.config import load_config
from fastapi.testclient import TestClient

class TestAuthFeatures(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_is_lan_ip(self):
        self.assertTrue(is_lan_ip("127.0.0.1"))
        self.assertTrue(is_lan_ip("::1"))
        self.assertTrue(is_lan_ip("localhost"))
        self.assertTrue(is_lan_ip("192.168.1.50"))
        self.assertTrue(is_lan_ip("10.0.0.1"))
        self.assertTrue(is_lan_ip("172.16.0.1"))
        self.assertFalse(is_lan_ip("8.8.8.8"))
        self.assertFalse(is_lan_ip("1.1.1.1"))
        self.assertFalse(is_lan_ip(None))

    def test_auth_status_endpoint(self):
        res = self.client.get("/api/auth/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("auth_enabled", data)
        self.assertIn("has_access_code", data)
        self.assertIn("allow_lan_bypass", data)
        self.assertIn("is_lan", data)

    def test_access_code_login(self):
        # Incorrect code
        res_fail = self.client.post("/api/auth/code", json={"code": "wrong_code"})
        self.assertEqual(res_fail.status_code, 403)

        # Correct code configured in config.local.json ("888888")
        res_ok = self.client.post("/api/auth/code", json={"code": "888888"})
        self.assertEqual(res_ok.status_code, 200)
        data = res_ok.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("token", data)
        token = data["token"]

        # Access protected endpoint with token
        status_res = self.client.get("/api/auth/status", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(status_res.status_code, 200)
        self.assertTrue(status_res.json()["logged_in"])

if __name__ == "__main__":
    unittest.main()
