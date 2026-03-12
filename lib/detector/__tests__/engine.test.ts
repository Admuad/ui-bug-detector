import { describe, it, expect } from 'vitest';
import {
    _calculateScore,
    _deduplicateBugs,
    _addPriorityScores,
    _limitAndTagBugs,
    _groupAccessibilityBugs,
} from '../engine';
import type { Bug } from '../types';

function makeBug(overrides: Partial<Bug> = {}): Bug {
    return {
        id: crypto.randomUUID(),
        code: 'LAYOUT_OVERFLOW',
        severity: 'minor',
        message: 'Some bug message',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// calculateScore
// ---------------------------------------------------------------------------
describe('_calculateScore', () => {
    it('returns 100 for no bugs', () => {
        expect(_calculateScore([])).toBe(100);
    });

    it('returns less than 100 when bugs exist', () => {
        const bugs = [makeBug({ severity: 'critical' })];
        expect(_calculateScore(bugs)).toBeLessThan(100);
    });

    it('penalises critical bugs more than minor ones', () => {
        const withCritical = [makeBug({ severity: 'critical' })];
        const withMinor = [makeBug({ severity: 'minor' })];
        expect(_calculateScore(withCritical)).toBeLessThan(_calculateScore(withMinor));
    });

    it('never returns below 0', () => {
        const bugs = Array.from({ length: 50 }, () =>
            makeBug({ severity: 'critical', code: `CODE_${Math.random()}` })
        );
        expect(_calculateScore(bugs)).toBeGreaterThanOrEqual(0);
    });

    it('applies diminishing returns for repeated bug codes', () => {
        const oneUnique = [makeBug({ severity: 'major', code: 'X' })];
        const manyUnique = Array.from({ length: 5 }, (_, i) =>
            makeBug({ severity: 'major', code: `X${i}` })
        );
        const manyRepeated = Array.from({ length: 5 }, () =>
            makeBug({ severity: 'major', code: 'X' })
        );
        // Many unique bugs should penalise more than many bugs of the same type
        expect(_calculateScore(manyUnique)).toBeLessThanOrEqual(_calculateScore(manyRepeated));
        // At least one unique bug should still penalise vs zero bugs
        expect(_calculateScore(oneUnique)).toBeLessThan(100);
    });
});

// ---------------------------------------------------------------------------
// deduplicateBugs
// ---------------------------------------------------------------------------
describe('_deduplicateBugs', () => {
    it('returns the same bug if only one exists', () => {
        const bug = makeBug({ code: 'TYPO', message: 'Typo detected' });
        expect(_deduplicateBugs([bug])).toHaveLength(1);
    });

    it('removes exact duplicate code+message combinations', () => {
        const bug = makeBug({ code: 'TYPO', message: 'Typo detected', selector: '#el' });
        expect(_deduplicateBugs([bug, bug])).toHaveLength(1);
    });

    it('treats [Desktop] and [Mobile] prefixed messages as duplicates', () => {
        const desktop = makeBug({ code: 'LAYOUT_OVERFLOW', message: '[Desktop] Overflow' });
        const mobile = makeBug({ code: 'LAYOUT_OVERFLOW', message: '[Mobile] Overflow' });
        expect(_deduplicateBugs([desktop, mobile])).toHaveLength(1);
    });

    it('keeps bugs with different codes', () => {
        const a = makeBug({ code: 'TYPO', message: 'Typo' });
        const b = makeBug({ code: 'LAYOUT_OVERFLOW', message: 'Typo' });
        expect(_deduplicateBugs([a, b])).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// addPriorityScores
// ---------------------------------------------------------------------------
describe('_addPriorityScores', () => {
    it('attaches a priorityScore to every bug', () => {
        const bugs = [makeBug({ severity: 'critical' }), makeBug({ severity: 'minor' })];
        const result = _addPriorityScores(bugs);
        result.forEach(b => {
            expect(b.priorityScore).toBeDefined();
            expect(b.priorityScore).toBeGreaterThanOrEqual(0);
            expect(b.priorityScore).toBeLessThanOrEqual(100);
        });
    });

    it('gives critical bugs a higher priority score than optimization bugs', () => {
        const critical = _addPriorityScores([makeBug({ severity: 'critical', code: 'X' })]);
        const optim = _addPriorityScores([makeBug({ severity: 'optimization', code: 'Y' })]);
        expect(critical[0].priorityScore!).toBeGreaterThan(optim[0].priorityScore!);
    });

    it('returns an empty array for no bugs', () => {
        expect(_addPriorityScores([])).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// limitAndTagBugs
// ---------------------------------------------------------------------------
describe('_limitAndTagBugs', () => {
    it('prefixes the viewport label to the message', () => {
        const bug = makeBug({ message: 'Something broke' });
        const result = _limitAndTagBugs([bug], 'Desktop', 'https://example.com', 10);
        expect(result[0].message).toBe('[Desktop] Something broke');
    });

    it('respects the limit parameter', () => {
        const bugs = Array.from({ length: 5 }, () => makeBug());
        expect(_limitAndTagBugs(bugs, 'Mobile', 'https://example.com', 3)).toHaveLength(3);
    });

    it('sets pageUrl on each bug', () => {
        const bug = makeBug();
        const result = _limitAndTagBugs([bug], 'Desktop', 'https://test.com', 10);
        expect(result[0].pageUrl).toBe('https://test.com');
    });

    it('appends viewport to existing locationDescription', () => {
        const bug = makeBug({ locationDescription: 'Header section' });
        const result = _limitAndTagBugs([bug], 'Tablet', 'https://example.com', 10);
        expect(result[0].locationDescription).toContain('Tablet');
    });

    it('creates a default locationDescription when one is absent', () => {
        const bug = makeBug({ locationDescription: undefined });
        const result = _limitAndTagBugs([bug], 'Mobile', 'https://example.com', 10);
        expect(result[0].locationDescription).toBe('Viewport: Mobile');
    });
});

// ---------------------------------------------------------------------------
// groupAccessibilityBugs
// ---------------------------------------------------------------------------
describe('_groupAccessibilityBugs', () => {
    it('groups multiple A11Y_REGION bugs into a single summary', () => {
        const bugs = Array.from({ length: 4 }, () =>
            makeBug({ code: 'A11Y_REGION', message: 'Missing landmark' })
        );
        const result = _groupAccessibilityBugs(bugs);
        expect(result).toHaveLength(1);
        expect(result[0].message).toContain('4 occurrences');
    });

    it('leaves non-grouped bugs as standalone', () => {
        const bugs = [
            makeBug({ code: 'TYPO', message: 'Typo' }),
            makeBug({ code: 'MEDIA_BROKEN', message: 'Broken image' }),
        ];
        expect(_groupAccessibilityBugs(bugs)).toHaveLength(2);
    });

    it('groups A11Y_LANDMARK-ONE-MAIN separately from A11Y_REGION', () => {
        const bugs = [
            makeBug({ code: 'A11Y_REGION', message: 'Region' }),
            makeBug({ code: 'A11Y_REGION', message: 'Region' }),
            makeBug({ code: 'A11Y_LANDMARK-ONE-MAIN', message: 'Landmark' }),
            makeBug({ code: 'A11Y_LANDMARK-ONE-MAIN', message: 'Landmark' }),
        ];
        const result = _groupAccessibilityBugs(bugs);
        // Two groups (one per code)
        expect(result).toHaveLength(2);
    });

    it('returns an empty array for no bugs', () => {
        expect(_groupAccessibilityBugs([])).toHaveLength(0);
    });
});
