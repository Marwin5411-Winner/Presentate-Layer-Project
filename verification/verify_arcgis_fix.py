from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating to dashboard...")
        page.goto("http://localhost:5173")

        # Wait for map to load (canvas)
        print("Waiting for map canvas...")
        page.wait_for_selector(".esri-view-surface", timeout=30000)

        # Wait a bit for tiles to load
        time.sleep(5)

        # Take screenshot of the fixed implementation
        print("Taking screenshot of map...")
        page.screenshot(path="verification/fixed_map.png")

        browser.close()

if __name__ == "__main__":
    run()
