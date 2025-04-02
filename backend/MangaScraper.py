import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import argparse
import os
from lxml import etree
from urllib.parse import urljoin

# --- Configuration: Define paths relative to the project root --- #
# Assumes the script is run from the repository root or the path is adjusted in the GitHub workflow
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES_FILE_PATH = os.path.join(PROJECT_ROOT, 'docs', 'data', 'manga_sources.json')
CHAPTERS_FILE_PATH = os.path.join(PROJECT_ROOT, 'docs', 'data', 'manga_chapters.json')
os.makedirs(os.path.dirname(SOURCES_FILE_PATH), exist_ok=True) # Ensure directory exists
# --- End Configuration --- #

def load_manga_sources(filepath=SOURCES_FILE_PATH):
    # Ensure the sources file exists, creating it if necessary
    if not os.path.exists(filepath):
        print(f"Sources file not found at {filepath}. Creating an empty file.")
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump([], f) # Write empty JSON list
        return []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        print(f"Error decoding JSON from {filepath}. Returning empty list.")
        return []
    except FileNotFoundError:
        print(f"Sources file not found at {filepath}. Returning empty list.")
        return []

def save_manga_chapters(chapters_data, filepath=CHAPTERS_FILE_PATH):
    """Saves the final structured manga chapter data (flat list) to the JSON file."""
    # Ensure the directory exists before writing
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(chapters_data, f, indent=2, ensure_ascii=False)
        print(f"Successfully saved updated chapter data to {filepath}")
    except Exception as e:
        print(f"Error saving manga chapters to {filepath}: {e}")

def scrape_manga(url, selector, use_xpath=False):
    """
    Scrapes the manga page for the latest chapter text and its URL.
    Returns a dictionary {'text': chapter_text, 'url': chapter_url, 'scrapedAt': timestamp} or default values.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    now_iso = datetime.now().isoformat()
    default_result = {"text": "Unknown", "url": None, "scrapedAt": now_iso}
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

                return {"text": chapter_text, "url": chapter_url, "scrapedAt": now_iso}
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

                return {"text": chapter_text, "url": chapter_url, "scrapedAt": now_iso}
            else:
                print(f"Warning: Selector '{selector}' not found on {url}")
                return default_result

    except requests.exceptions.RequestException as e: # Catch more specific exceptions
        print(f"Error scraping {url}: {e}")
        return {"text": "Error", "url": None, "scrapedAt": now_iso} # Return error with timestamp
    except Exception as e:
        print(f"An unexpected error occurred while scraping {url}: {e}")
        # Optionally log the full traceback here for debugging
        # import traceback
        # traceback.print_exc()
        return default_result


def update_manga_chapters():
    sources = load_manga_sources()
    
    if not sources:
        print("No sources found. Exiting scrape process.")
        save_manga_chapters([]) # Save an empty list if no sources
        return

    final_output_data = [] # This will hold the flat list for the frontend

    for source in sources:
        # Basic validation for source entry
        if isinstance(source, dict) and all(k in source for k in ['name', 'url', 'selector']):
            manga_name = source['name']
            source_url = source['url']
            # Use manga name as a simple ID if 'id' isn't present, otherwise use 'id'
            manga_id = source.get('id', manga_name) 
            if source.get('isActive', True):
                print(f"Scraping {manga_name} from {source_url}...")
                scrape_result = scrape_manga(source_url, source['selector'], source.get('use_xpath', False))

                # Prepare the output dictionary for this manga
                manga_output = {
                    "id": manga_id, # Use ID from source or fallback to name
                    "name": manga_name,
                    "source_url": source_url, # Include the original source URL
                    "latest_chapter_text": scrape_result['text'],
                    "latest_chapter_url": scrape_result['url'],
                    "last_scraped_at": scrape_result['scrapedAt']
                }
                final_output_data.append(manga_output)
                print(f"  -> Result for {manga_name}: {scrape_result['text']} @ {scrape_result['url'] or 'No URL'}")
            else:
                print(f"Skipping inactive source: {manga_name}")
        else:
            print(f"Warning: Skipping invalid source entry: {source}")

    save_manga_chapters(final_output_data) # Save the flat list

# --- Command Line Argument Parsing Logic ---
# (Keep the existing argparse logic for add, list, test, etc., but update `update` action)

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

    # Clear Chapters action
    parser_clear = subparsers.add_parser('clear', help='Clear all but the latest chapter for a manga')
    parser_clear.add_argument('--id', type=int, required=True, help="Manga ID to clear chapters for")

    args = parser.parse_args()

    if args.action == 'update':
        chapters = update_manga_chapters()
        if chapters: # Check if update returned anything
            print(f"\nUpdate complete. Checked {len(chapters)} active manga.")
        else:
            print("\nUpdate process finished.") # Handle case where sources might be empty
    elif args.action == 'add':
        # The add_manga function is now likely obsolete or needs significant rework
        # as it relied on the old data structure in manga_chapters.json.
        # For now, the primary way to update chapters is via `update_manga_chapters` triggered
        # by the workflow, and adding sources is via the frontend UI.
        print("The 'add' command is currently not supported. Please use the frontend UI to add manga sources.")
    elif args.action == 'remove':
        # The remove_manga function is not implemented in this version
        print("The 'remove' command is not implemented in this version.")
    elif args.action == 'list':
        list_manga()
    elif args.action == 'test':
        test_selector(args.url, args.selector, args.xpath)
    elif args.action == 'mark':
        # The mark_manga_read function is now likely obsolete or needs significant rework
        # as it relied on the old data structure in manga_chapters.json.
        # For now, the primary way to update chapters is via `update_manga_chapters` triggered
        # by the workflow, and marking as read is via the frontend UI.
        print("The 'mark' command is currently not supported. Please use the frontend UI to mark manga as read.")
    elif args.action == 'clear':
        # The clear_manga_chapters function is now likely obsolete or needs significant rework
        # as it relied on the old data structure in manga_chapters.json.
        # For now, the primary way to update chapters is via `update_manga_chapters` triggered
        # by the workflow, and clearing chapters is via the frontend UI.
        print("The 'clear' command is currently not supported. Please use the frontend UI to clear manga chapters.")
