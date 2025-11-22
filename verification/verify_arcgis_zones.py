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

        # Take screenshot of the initial view (should be Dark Matter)
        print("Taking screenshot of dark map...")
        page.screenshot(path="verification/dark_map_zones.png")

        # Try to simulate context menu to see if it appears
        # Center of screen
        viewport = page.viewport_size
        cx = viewport['width'] / 2
        cy = viewport['height'] / 2

        print(f"Right clicking at {cx}, {cy}")
        page.mouse.move(cx, cy)
        page.mouse.down(button="right")
        page.mouse.up(button="right")

        time.sleep(2)
        page.screenshot(path="verification/context_menu_test.png")

        browser.close()

if __name__ == "__main__":
    run()
