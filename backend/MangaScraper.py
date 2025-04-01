import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import argparse
import os
from lxml import etree

# Create data directory if it doesn't exist
data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
os.makedirs(data_dir, exist_ok=True)

def load_manga_sources(filename='manga_sources.json'):
    filepath = os.path.join(data_dir, filename)
    # Create empty file if it doesn't exist
    if not os.path.exists(filepath):
        with open(filepath, 'w') as f:
            f.write('[]')  # Write valid empty JSON array
    
    with open(filepath, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            print(f"Error loading {filename}. Creating a new empty file.")
            with open(filepath, 'w') as f:
                f.write('[]')
            return []

def save_manga_chapters(chapters, filename='manga_chapters.json'):
    filepath = os.path.join(data_dir, filename)
    with open(filepath, 'w') as f:
        json.dump(chapters, f, indent=2)

def scrape_manga(url, selector, use_xpath=False):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        if use_xpath:
            # Using lxml parser for XPath support
            html = etree.HTML(str(soup))
            elements = html.xpath(selector)
            if elements:
                latest_chapter = elements[0].text
                return latest_chapter
            else:
                print(f"Warning: XPath '{selector}' not found on {url}")
                return "Unknown"
        else:
            # Using CSS selector
            element = soup.select_one(selector)
            if element:
                return element.text.strip()
            else:
                print(f"Warning: Selector '{selector}' not found on {url}")
                return "Unknown"
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return "Error"

def update_manga_chapters():
    sources = load_manga_sources()
    
    # If sources is empty, return empty list
    if not sources:
        print("No manga sources found. Add some first with 'add' command.")
        return []
    
    # Try to load existing chapters to preserve read status
    try:
        chapters_file = os.path.join(data_dir, 'manga_chapters.json')
        if os.path.exists(chapters_file):
            with open(chapters_file, 'r') as f:
                existing_chapters = json.load(f)
            # Create lookup for read status
            read_status = {ch['id']: ch.get('isRead', False) for ch in existing_chapters}
        else:
            read_status = {}
    except:
        read_status = {}
    
    chapters = []
    
    for manga in sources:
        if manga.get('isActive', True):
            print(f"Scraping {manga['name']} from {manga['url']}")
            latest_chapter = scrape_manga(manga['url'], manga['selector'], manga.get('use_xpath', False))
            chapters.append({
                'id': manga['id'],
                'title': manga['name'],
                'latestChapter': latest_chapter,
                'url': manga['url'],
                'lastUpdated': datetime.now().isoformat(),
                'isRead': read_status.get(manga['id'], False)  # Preserve read status
            })
    
    save_manga_chapters(chapters)
    return chapters

def add_manga(name, url, selector, use_xpath=False):
    sources = load_manga_sources()
    new_id = max([manga.get('id', 0) for manga in sources], default=0) + 1
    sources.append({
        'id': new_id,
        'name': name,
        'url': url,
        'selector': selector,
        'use_xpath': use_xpath,
        'isActive': True
    })
    
    filepath = os.path.join(data_dir, 'manga_sources.json')
    with open(filepath, 'w') as f:
        json.dump(sources, f, indent=2)
    print(f"Added manga: {name} (ID: {new_id})")

def remove_manga(manga_id):
    sources = load_manga_sources()
    sources = [manga for manga in sources if manga.get('id') != manga_id]
    
    filepath = os.path.join(data_dir, 'manga_sources.json')
    with open(filepath, 'w') as f:
        json.dump(sources, f, indent=2)
    print(f"Removed manga with ID: {manga_id}")

def list_manga():
    sources = load_manga_sources()
    if not sources:
        print("No manga added yet. Use 'add' command to add some.")
        return
    
    print("\nYour Manga List:")
    print("-" * 50)
    for manga in sources:
        status = "Active" if manga.get('isActive', True) else "Inactive"
        xpath_status = "XPath" if manga.get('use_xpath', False) else "CSS Selector"
        print(f"ID: {manga.get('id')}, Name: {manga['name']}, Status: {status}")
        print(f"URL: {manga['url']}")
        print(f"Selector ({xpath_status}): {manga['selector']}")
        print("-" * 50)

def test_selector(url, selector, use_xpath=False):
    print(f"Testing {'XPath' if use_xpath else 'CSS Selector'} '{selector}' on {url}")
    result = scrape_manga(url, selector, use_xpath)
    print(f"Result: {result}")
    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manga Chapter Tracker")
    parser.add_argument('action', choices=['update', 'add', 'remove', 'list', 'test'])
    parser.add_argument('--name', help="Manga name (for add action)")
    parser.add_argument('--url', help="Manga URL (for add/test action)")
    parser.add_argument('--selector', help="CSS selector or XPath for latest chapter (for add/test action)")
    parser.add_argument('--xpath', action='store_true', help="Use XPath instead of CSS selector")
    parser.add_argument('--id', type=int, help="Manga ID (for remove action)")
    
    args = parser.parse_args()
    
    if args.action == 'update':
        chapters = update_manga_chapters()
        print(f"Updated {len(chapters)} manga chapters")
    elif args.action == 'add':
        if not (args.name and args.url and args.selector):
            print("Error: Name, URL, and selector are required for adding a manga")
        else:
            add_manga(args.name, args.url, args.selector, args.xpath)
    elif args.action == 'remove':
        if not args.id:
            print("Error: ID is required for removing a manga")
        else:
            remove_manga(args.id)
    elif args.action == 'list':
        list_manga()
    elif args.action == 'test':
        if not (args.url and args.selector):
            print("Error: URL and selector are required for testing")
        else:
            test_selector(args.url, args.selector, args.xpath)
