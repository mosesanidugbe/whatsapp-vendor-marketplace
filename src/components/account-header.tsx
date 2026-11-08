"use client";

import { useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

type AccountHeaderProps = {
  showOrdersLink?: boolean;
  showAccountLink?: boolean;
  showExploreLink?: boolean;
};

export function AccountHeader({
  showOrdersLink = false,
  showAccountLink = false,
  showExploreLink = true,
}: AccountHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="account-header">
      <Link className="brand" href="/" aria-label="Marketday home">
        <span className="brand-mark">m</span>
        <span>marketday<span className="brand-period">.</span></span>
      </Link>

      <div className="account-header-actions">
        {showOrdersLink && <Link className="sign-in" href="/account/orders">My orders</Link>}
        {showAccountLink && <Link className="sign-in" href="/account">My account</Link>}
        {showExploreLink && <Link className="sign-in" href="/">Explore marketplace</Link>}
        <SignOutButton className="button button-dark button-small" />
      </div>

      <button
        className="account-menu-toggle"
        type="button"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? "account-mobile-menu" : undefined}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      {menuOpen && (
        <nav className="account-mobile-menu" id="account-mobile-menu" aria-label="Account navigation">
          {showOrdersLink && <Link href="/account/orders" onClick={() => setMenuOpen(false)}>My orders</Link>}
          {showAccountLink && <Link href="/account" onClick={() => setMenuOpen(false)}>My account</Link>}
          {showExploreLink && <Link href="/" onClick={() => setMenuOpen(false)}>Explore marketplace</Link>}
          <SignOutButton className="account-mobile-signout" />
        </nav>
      )}
    </header>
  );
}
