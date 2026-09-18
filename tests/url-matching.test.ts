import { describe, it, expect } from 'vitest';
import { domainMatches, getDomainFromUrl, normalizeDomain } from '../src/utils/url';

describe('UrlMatching', () => {
  it('normalizes domain correctly', () => {
    expect(normalizeDomain('www.instagram.com')).toBe('instagram.com');
    expect(normalizeDomain('WWW.YOUTUBE.COM:8080')).toBe('youtube.com');
    expect(normalizeDomain('sub.example.co.uk')).toBe('sub.example.co.uk');
  });

  it('matches exact and subdomains correctly', () => {
    expect(domainMatches('instagram.com', 'instagram.com')).toBe(true);
    expect(domainMatches('www.instagram.com', 'instagram.com')).toBe(true);
    expect(domainMatches('reels.instagram.com', 'instagram.com')).toBe(true);
    expect(domainMatches('m.youtube.com', 'youtube.com')).toBe(true);
  });

  it('prevents accidental partial prefix/suffix collisions', () => {
    // Crucial requirement: fakeinstagram.com must NOT match instagram.com
    expect(domainMatches('fakeinstagram.com', 'instagram.com')).toBe(false);
    expect(domainMatches('notinstagram.com', 'instagram.com')).toBe(false);
    expect(domainMatches('instagram.com.attacker.com', 'instagram.com')).toBe(false);
    expect(domainMatches('myoutube.com', 'youtube.com')).toBe(false);
  });

  it('extracts domain from full URL strings', () => {
    expect(getDomainFromUrl('https://www.instagram.com/p/C12345/')).toBe('instagram.com');
    expect(getDomainFromUrl('https://m.youtube.com/watch?v=abcdef')).toBe('youtube.com');
    expect(getDomainFromUrl('invalid-url')).toBe('');
  });
});
