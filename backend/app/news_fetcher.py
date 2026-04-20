"""
Live news signal fetcher using NewsAPI.org.

Runs every 6 hours via APScheduler. Fetches AI displacement headlines,
deduplicates by URL, stores top 50 most recent in signals_live.json.

Requires NEWS_API_KEY environment variable.
"""
import json
import logging
import os
from datetime import datetime
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

DISPLACEMENT_QUERIES = [
    'AI layoffs',
    'automation job cuts',
    'AI replacing workers',
    'AI workforce reduction',
    'replaced by AI employees',
    'generative AI job displacement',
    'AI agents replacing staff',
]

SIGNALS_PATH = Path(__file__).parent.parent / "data" / "signals_live.json"


def fetch_live_signals():
    """Fetch displacement-related news from NewsAPI and save to signals_live.json."""
    api_key = os.getenv('NEWS_API_KEY')
    if not api_key:
        logger.warning("NEWS_API_KEY not set — skipping live signal fetch")
        return

    logger.info("Fetching live displacement signals from NewsAPI...")
    seen_urls: set[str] = set()
    articles: list[dict] = []

    for q in DISPLACEMENT_QUERIES:
        try:
            r = requests.get(
                'https://newsapi.org/v2/everything',
                params={
                    'q': q,
                    'language': 'en',
                    'sortBy': 'publishedAt',
                    'pageSize': 20,
                    'apiKey': api_key,
                },
                timeout=15,
            )
            if not r.ok:
                logger.warning(f"NewsAPI query '{q}' failed: {r.status_code}")
                continue
            for art in r.json().get('articles', []):
                url = art.get('url', '')
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    articles.append({
                        'id': len(articles),
                        'raw_text': art.get('title', ''),
                        'description': art.get('description', ''),
                        'source_url': url,
                        'source_name': (art.get('source') or {}).get('name', ''),
                        'confidence': 2,
                        'found_at': art.get('publishedAt', ''),
                        'status': 'pending',
                    })
        except Exception as e:
            logger.warning(f"NewsAPI query '{q}' error: {e}")

    # Sort by published date, keep top 50
    articles.sort(key=lambda a: a.get('found_at', ''), reverse=True)
    articles = articles[:50]

    result = {
        'signals': articles,
        'count': len(articles),
        'source': 'newsapi_live',
        'fetched_at': datetime.now().isoformat(),
    }

    SIGNALS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(SIGNALS_PATH, 'w') as f:
        json.dump(result, f, indent=2)

    logger.info(f"Saved {len(articles)} live signals to {SIGNALS_PATH}")
    return result


def start_signal_scheduler():
    """Start background scheduler for periodic signal fetching."""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger

        scheduler = BackgroundScheduler()
        scheduler.add_job(
            fetch_live_signals,
            trigger=IntervalTrigger(hours=6),
            id='newsapi_fetch',
            name='NewsAPI Signal Fetch (6h)',
            replace_existing=True,
        )
        scheduler.start()
        logger.info("Signal scheduler started (every 6 hours)")
    except ImportError:
        logger.warning("APScheduler not installed — signal fetch will only run on startup")
    except Exception as e:
        logger.warning(f"Failed to start signal scheduler: {e}")
