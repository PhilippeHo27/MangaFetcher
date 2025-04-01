import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import argparse
import os
from lxml import etree
from urllib.parse import urljoin

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
    # Ensure the directory exists before writing
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w') as f:
        json.dump(chapters, f, indent=2)

def scrape_manga(url, selector, use_xpath=False):
    """
    Scrapes the manga page for the latest chapter text and its URL.
    Returns a dictionary {'text': chapter_text, 'url': chapter_url} or default values.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    default_result = {"text": "Unknown", "url": None}
    try:
        response = requests.get(url, headers=headers, timeout=15) # Added timeout
        response.raise_for_status()

        chapter_text = "Unknown"
        chapter_url = None

        if use_xpath:
            # Using lxml parser for XPath support
            # Need to parse the response content directly with lxml for better XPath handling
            html_parser = etree.HTMLParser()
            tree = etree.fromstring(response.content, html_parser)
            elements = tree.xpath(selector)
            if elements:
                # Assuming the first element found contains the chapter text
                # Attempt to get text content robustly
                chapter_text = ''.join(elements[0].itertext()).strip()

                # Try to find the closest ancestor 'a' tag for the URL
                current_element = elements[0]
                while current_element is not None:
                    if current_element.tag == 'a' and 'href' in current_element.attrib:
                        chapter_url = current_element.get('href')
                        # Make URL absolute if it's relative
                        if chapter_url and not chapter_url.startswith(('http://', 'https://')):
                            chapter_url = urljoin(url, chapter_url)
                        break
                    current_element = current_element.getparent()

                return {"text": chapter_text, "url": chapter_url}
            else:
                print(f"Warning: XPath '{selector}' not found on {url}")
                return default_result
        else:
            # Using CSS selector with BeautifulSoup
            soup = BeautifulSoup(response.text, 'html.parser') # Use html.parser as default
            element = soup.select_one(selector)
            if element:
                chapter_text = element.text.strip()
                # Try to find the closest 'a' tag parent for the URL
                anchor_tag = element.find_parent('a')
                if anchor_tag and anchor_tag.has_attr('href'):
                    chapter_url = anchor_tag['href']
                    # Make URL absolute if it's relative
                    if chapter_url and not chapter_url.startswith(('http://', 'https://')):
                         chapter_url = urljoin(url, chapter_url)

                return {"text": chapter_text, "url": chapter_url}
            else:
                print(f"Warning: Selector '{selector}' not found on {url}")
                return default_result

    except requests.exceptions.RequestException as e: # Catch more specific exceptions
        print(f"Error scraping {url}: {e}")
        return {"text": "Error", "url": None}
    except Exception as e:
        print(f"An unexpected error occurred while scraping {url}: {e}")
        # Optionally log the full traceback here for debugging
        # import traceback
        # traceback.print_exc()
        return default_result


def update_manga_chapters():
    sources = load_manga_sources()
    
    # If sources is empty, return empty list
    if not sources:
        print("No manga sources found. Add some first with 'add' command.")
        return []
    
    try:
        chapters_file = os.path.join(data_dir, 'manga_chapters.json')
        if os.path.exists(chapters_file) and os.path.getsize(chapters_file) > 0: # Check if file exists and is not empty
            with open(chapters_file, 'r') as f:
                try:
                    existing_chapters = json.load(f)
                    # Create lookup for read status
                    read_status = {ch['id']: ch.get('isRead', False) for ch in existing_chapters if isinstance(ch, dict) and 'id' in ch}
                except json.JSONDecodeError:
                    print(f"Error decoding JSON from {chapters_file}. Starting fresh.")
                    existing_chapters = []
                    read_status = {}
        else:
            read_status = {}
            # Create manga_chapters.json if it doesn't exist or is empty
            if not os.path.exists(chapters_file) or os.path.getsize(chapters_file) == 0:
                 with open(chapters_file, 'w') as f:
                    f.write('[]') # Initialize with empty JSON array

    except Exception as e: # Catch potential errors during file loading
        print(f"Error loading existing chapters: {e}. Starting fresh.")
        read_status = {}

    chapters = []
    
    for manga in sources:
        # Ensure manga is a dictionary and has necessary keys
        if isinstance(manga, dict) and 'id' in manga and 'name' in manga and 'url' in manga and 'selector' in manga:
            if manga.get('isActive', True):
                print(f"Scraping {manga['name']} from {manga['url']} using {'XPath' if manga.get('use_xpath') else 'CSS Selector'}")
                latest_chapter_info = scrape_manga(manga['url'], manga['selector'], manga.get('use_xpath', False))
                chapters.append({
                    'id': manga['id'],
                    'title': manga['name'],
                    'latestChapter': latest_chapter_info, # Store dict {'text': ..., 'url': ...}
                    'sourceUrl': manga['url'], # Renamed 'url' to 'sourceUrl' for clarity
                    'lastUpdated': datetime.now().isoformat(),
                    'isRead': read_status.get(manga['id'], False) # Preserve read status
                })
        else:
             print(f"Skipping invalid manga entry: {manga}")

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

def mark_manga_read(manga_id, is_read=True):
    """Marks a specific manga as read or unread in manga_chapters.json."""
    chapters_file = os.path.join(data_dir, 'manga_chapters.json')
    chapters = []
    try:
        if os.path.exists(chapters_file) and os.path.getsize(chapters_file) > 0:
            with open(chapters_file, 'r') as f:
                chapters = json.load(f)
        else:
             print(f"Warning: {chapters_file} not found or empty. Cannot mark as read.")
             return False # Indicate failure

    except json.JSONDecodeError:
        print(f"Error decoding JSON from {chapters_file}. Cannot mark as read.")
        return False # Indicate failure
    except Exception as e:
        print(f"Error loading {chapters_file}: {e}")
        return False # Indicate failure


    updated = False
    for chapter in chapters:
         # Ensure chapter is a dictionary and has an 'id' key
         if isinstance(chapter, dict) and chapter.get('id') == manga_id:
            chapter['isRead'] = is_read
            updated = True
            break # Assuming unique IDs

    if updated:
        save_manga_chapters(chapters)
        status = "read" if is_read else "unread"
        print(f"Marked manga ID {manga_id} as {status}.")
        return True # Indicate success
    else:
        print(f"Manga ID {manga_id} not found in chapters data.")
        return False # Indicate failure


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manga Chapter Tracker")
    subparsers = parser.add_subparsers(dest='action', help='Available actions', required=True)

    # Update action
    parser_update = subparsers.add_parser('update', help='Update all active manga chapters')

    # Add action
    parser_add = subparsers.add_parser('add', help='Add a new manga source')
    parser_add.add_argument('--name', required=True, help="Manga name")
    parser_add.add_argument('--url', required=True, help="Manga URL (main page)")
    parser_add.add_argument('--selector', required=True, help="CSS selector or XPath for latest chapter link/text")
    parser_add.add_argument('--xpath', action='store_true', help="Use XPath instead of CSS selector")

    # Remove action
    parser_remove = subparsers.add_parser('remove', help='Remove a manga source by ID')
    parser_remove.add_argument('--id', type=int, required=True, help="Manga ID")

    # List action
    parser_list = subparsers.add_parser('list', help='List all added manga sources')

    # Test action
    parser_test = subparsers.add_parser('test', help='Test a selector on a URL')
    parser_test.add_argument('--url', required=True, help="Manga URL to test")
    parser_test.add_argument('--selector', required=True, help="CSS selector or XPath to test")
    parser_test.add_argument('--xpath', action='store_true', help="Use XPath instead of CSS selector")

     # Mark Read/Unread action
    parser_mark = subparsers.add_parser('mark', help='Mark a manga as read or unread')
    parser_mark.add_argument('--id', type=int, required=True, help="Manga ID to mark")
    parser_mark.add_argument('--unread', action='store_true', help="Mark as unread instead of read")


    args = parser.parse_args()

    if args.action == 'update':
        chapters = update_manga_chapters()
        if chapters: # Check if update returned anything
             print(f"\nUpdate complete. Checked {len(chapters)} active manga.")
        else:
             print("\nUpdate process finished.") # Handle case where sources might be empty
    elif args.action == 'add':
        add_manga(args.name, args.url, args.selector, args.xpath)
    elif args.action == 'remove':
        remove_manga(args.id)
    elif args.action == 'list':
        list_manga()
    elif args.action == 'test':
        test_selector(args.url, args.selector, args.xpath)
    elif args.action == 'mark':
         mark_manga_read(args.id, not args.unread) # Pass False if --unread is specified
