#!/usr/bin/env python3
"""Smoke-test a *real* production site (not the Lumen test fixture) in Chromium or WebKit."""
import argparse
import os
import re

from playwright.sync_api import sync_playwright

HOST = os.environ.get("CLIENT_SITE_URL", "http://127.0.0.1:4176")


def must_equal(locator, expected, label):
    actual = (locator.first.text_content() or "").strip()
    assert actual == expected, f"{label}: {actual!r} instead of {expected!r}"


def check(browser, width, height, mobile, language):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        is_mobile=mobile,
        has_touch=mobile,
        locale="ru-RU",
        reduced_motion="reduce",
    )
    page = context.new_page()
    errors = []
    failed_assets = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda response: failed_assets.append(response.url)
            if response.status >= 400 and response.url.startswith(HOST)
            and re.search(r"\.(?:js|css|webp|png|jpe?g|svg)(?:\?|$)", response.url)
            else None)
    page.goto(HOST, wait_until="domcontentloaded", timeout=30000)
    data = page.evaluate("window.TANEM_SITE_DATA")
    assert data and data["mode"] == "production", "Site did not load production data"
    if language not in data.get("locales", []):
        device = "touch" if mobile else "desktop"
        print(f"SKIP {width}x{height}, {device}, {language}: locale is not enabled for this client")
        context.close()
        return
    desktop = (width >= 1024) or not mobile
    root = "#salon-desktop-v1" if desktop else "#salon-mobile"
    page.locator(root).wait_for(state="visible", timeout=18000)
    page.wait_for_function("!document.documentElement.classList.contains('br-booting')")
    switch = f'[data-desktop-lang="{language}"]' if desktop else f'[data-lang="{language}"]'
    page.locator(switch).first.click(timeout=9000)
    page.wait_for_timeout(250)
    brand = ".std-header-brand-main" if desktop else ".tn22-title"
    must_equal(page.locator(brand), data["salon"]["name"][language], "brand")
    if desktop:
        assert page.locator(".std-header-brand-main img").count() == 0, "Desktop header must always use one-line text branding"
    if desktop and data.get("media", {}).get("hero"):
        hero = data["media"]["hero"][0]
        expected_hero = hero if isinstance(hero, str) else hero.get("src")
        assert page.locator("#stdHeroMedia").first.get_attribute("src") == expected_hero, "Desktop hero did not use canonical hero"
    assert data["salon"]["name"][language] in page.title(), "Incorrect page title"
    cards = page.locator("#stdServiceList .dct-service-card" if desktop
                         else "#tn13Services .tn31-service-row")
    assert 0 < cards.count() <= len(data["services"]), "Wrong number of service cards"
    team_section = page.locator("#salonDesktopTeam" if desktop else "#tn13Team")
    reviews_section = page.locator("#salonDesktopReviews" if desktop else "#tn13Reviews")
    assert not team_section.is_hidden(), "Team is a permanent structural section"
    assert not reviews_section.is_hidden(), "Reviews are a permanent structural section"
    if not data["team"]:
        placeholder_cards = page.locator("#salonDesktopTeam .std-master.is-placeholder" if desktop else "#tn13Team .tn22-master-card.is-placeholder")
        assert placeholder_cards.count() == 4, "Empty team must preserve four neutral visual master cards"
        real_team_cards = page.locator("#salonDesktopTeam [data-desktop-master]" if desktop else "#tn13Team [data-mid]")
        assert real_team_cards.count() == 0, "Neutral team cards must not become invented specialists"
    if not data["reviews"]:
        review_cards = page.locator("#salonDesktopReviews .std-review-card" if desktop else "#tn13Reviews .br-review-card")
        assert review_cards.count() == 0, "Empty reviews state must not invent reviews"
    if not data["media"]["portfolio"]:
        portfolio_section = page.locator("#salonDesktopPortfolio" if desktop else "#tn13Portfolio")
        assert portfolio_section.is_hidden(), "Empty portfolio should remain optional"
    messenger_card = page.locator('#salonDesktopContacts [data-contact-type="messenger"]' if desktop else '#tn13Visit [data-contact-type="messenger"]')
    if not data.get("contacts", {}).get("messengerUrl"):
        assert messenger_card.count() == 1 and messenger_card.is_hidden(), "Missing messenger must not leave a visible contact card"
    address_sub = page.locator('#salonDesktopContacts [data-contact-type="address"] .std-contact-card-sub' if desktop else '#tn13Visit [data-contact-type="address"] strong+span')
    expected_map_copy = ("Открыть в Яндекс Картах" if data.get("country") == "RU" else "Открыть в Google Maps") if language == "ru" else ("Open in Yandex Maps" if data.get("country") == "RU" else "Open in Google Maps")
    if language in ("ru", "en"):
        must_equal(address_sub, expected_map_copy, "map provider action")


    # Owner-requested Beauty Lab checks, separate from the generic production smoke.
    directions = [m for m in data["team"] if m.get("profileType") == "direction"]
    if directions:
        assert len(directions) == len(data["categoryOrder"])
        assert directions[0]["categories"] == [data["categoryOrder"][0]]
        assert page.locator(".tanem-service-description").count() == 0
        if desktop:
            assert page.locator(".std-nav a").evaluate_all("(els)=>els.map(e=>e.hash)")[2:5] == ["#salonDesktopAbout", "#salonDesktopTeam", "#salonDesktopReviews"]
        air = page.locator('[data-tanem-service-id="service-001"]').first
        dry = page.locator('[data-tanem-service-id="service-003"]').first
        assert re.sub(r"\\s+", "", air.locator(".tanem-service-price").inner_text()) == ("от17000₽" if language == "ru" else "from17000₽")
        assert re.sub(r"\\s+", "", dry.locator(".tanem-service-price").inner_text()) == "1500₽"
        air.locator("summary").click()
        assert air.locator("details").get_attribute("open") is not None
        rows = air.locator(".tanem-service-tariffs > div")
        assert rows.count() == 4
        bounds = rows.evaluate_all("(els)=>els.map(e=>{const a=e.querySelector('dt'),b=e.querySelector('dd');return {h:a.getBoundingClientRect().height,line:parseFloat(getComputedStyle(a).lineHeight),left:a.getBoundingClientRect().right,right:b.getBoundingClientRect().left,price:b.getBoundingClientRect().right}})")
        assert all(r["h"] <= r["line"] + 1 and r["left"] <= r["right"] + 1 for r in bounds), bounds
        assert max(r["price"] for r in bounds) - min(r["price"] for r in bounds) <= 1, bounds
        air.locator("summary").click()
        if not desktop:
            air.scroll_into_view_if_needed()
            page.wait_for_function("document.querySelector('.tn23-section-nav').classList.contains('visible')")
            air.locator(".tanem-service-book").click()
            page.locator("#tn13BookSheet.open").wait_for(state="visible")
            assert page.locator(".tn23-section-nav").evaluate("(e)=>e.classList.contains('visible')")
            page.locator("#tn13BookClose").click()
            page.wait_for_function("!document.querySelector('#tn13BookSheet').classList.contains('closing')")
        page.locator("#stdOpenGallery" if desktop else ".tn22-port-all").click()
        tabs = page.locator("#stdGalleryBrowserTabs [data-gallery-category]" if desktop else "#tn13Gallery [data-gcat]")
        tabs.first.wait_for(state="visible")
        attr = "data-gallery-category" if desktop else "data-gcat"
        assert tabs.nth(0).get_attribute(attr) == "Салон"
        assert tabs.nth(1).get_attribute(attr) == "Волосы"
        assert "active" in (tabs.nth(1).get_attribute("class") or "")
        page.locator("#stdGalleryBrowserBack" if desktop else ".tn22-gallery-back").click()
        if not desktop:
            page.wait_for_function("!document.querySelector('#tn13Gallery').classList.contains('closing')")
        master = page.locator('[data-desktop-master="direction-1"]' if desktop else '[data-mid="direction-1"]').first
        master.click()
        overlay = page.locator("#stdMasterOverlay" if desktop else ".tn22-master-page")
        overlay.locator(".tanem-master-head").wait_for(state="visible")
        assert overlay.locator(".tanem-master-head h2").inner_text() == directions[0]["name"][language]
        assert overlay.locator(".tanem-master-head p").inner_text() == directions[0]["role"][language]
        ids = overlay.locator("[data-tanem-service-id]").evaluate_all("(els)=>els.map(e=>e.dataset.tanemServiceId)")
        assert ids and set(ids).issubset(set(directions[0]["serviceIds"]))
        works = overlay.locator(".tanem-master-gallery img").evaluate_all("(els)=>els.map(e=>e.getAttribute('src'))")
        assert works and set(works).issubset(set(directions[0]["work"]))
        overlay.locator("#stdMasterPageClose" if desktop else ".tn22-back").click()
        if not desktop:
            page.wait_for_function("!document.querySelector('.tn22-master-page').classList.contains('closing')")

    sample = page.locator("#stdHeaderBookBtn" if desktop else ".tn22-cta")
    sample.click(timeout=9000)
    links = page.locator("#stdBookOverlay .std-book-options a" if desktop
                         else "#tn13BookSheet .tn50-book-option")
    assert links.count() > 0, "Booking actions are missing"
    for href in [link.get_attribute("href") for link in links.all()]:
        assert href and href != "#" and (
            href.startswith(("https://", "tel:", "tg:", "viber:", "whatsapp:"))
        ), f"Invalid booking destination: {href}"
    visible = page.locator("body").inner_text()
    assert not re.search(r"SALON NAME|(?:Услуга|Service)\s+\d{2}\b", visible), (
        "Demo labels remain visible on a production page")
    # Google Maps embed can emit WebKit-only internal errors from its third-party
    # frame. Keep the filter narrow so TANEM application errors still fail the run.
    google_maps_frame_noise = (
        'Could not load "search_impl".',
        'Could not load "util".',
        'maps.googleapis.com/maps/api/mapsjs/gen_204?csp_test=true due to access control checks.',
    )
    app_errors = [error for error in errors if not any(token in error for token in google_maps_frame_noise)]
    assert not app_errors, f"JavaScript errors: {app_errors}"
    assert not failed_assets, f"Missing site assets: {failed_assets}"
    context.close()
    print(f"PASS {width}x{height}, {'touch' if mobile else 'desktop'}, {language}: customer data, cards and booking")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", choices=["chromium", "webkit"], default="chromium")
    args = parser.parse_args()
    with sync_playwright() as playwright:
        browser = getattr(playwright, args.engine).launch(headless=True)
        try:
            for case in [(1366, 900, False, "ru"), (1366, 900, False, "en"),
                         (1366, 900, False, "hy"), (390, 844, True, "ru"),
                         (390, 844, True, "en"), (390, 844, True, "hy"),
                         (1180, 820, True, "ru")]:
                check(browser, *case)
        finally:
            browser.close()
    print("PASS actual production site on desktop, phone and touch tablet")


if __name__ == "__main__":
    main()
