import { describe, it, expect } from 'vitest';
import {
    calculateScore,
    deduplicateBugs,
    addPriorityScores,
    limitAndTagBugs,
    groupAccessibilityBugs,
} from '../engine';
import type { Bug } from '../types';

function makeBug(overrides: Partial<Bug> = {}): Bug {
    return {
        id: crypto.randomUUID(),
        code: 'LAYOUT_OVERFLOW',
        severity: 'major',
        message: 'Element overflows viewport',
        ...overrides,
    };
}

describe('calculateScore', () => {
    it('returns 100 for no bugs', () => {
        expect(calculateScore([])).toBe(100);
    });

    it('reduces score for each bug', () => {
        const bugs = [makeBug({ severity: 'critical' })];
        expect(calculateScore(bugs)).toBeLessThan(100);
    });

    it('applies diminishing returns for repeated bug codes', () => {
        const singleBug = [makeBug({ severity: 'major', code: 'LAYOUT_OVERFLOW' })];
        const manyBugs = Array.from({ length: 10 }, () =>
            makeBug({ severity: 'major', code: 'LAYOUT_OVERFLOW' })
        );
        const singleScore = calculateScore(singleBug);
        const manyScore = calculateScore(manyBugs);
        expect(manyScore).toBeLessThan(singleScore);
    });

    it('never goes below 0', () => {
        const bugs = Array.from({ length: 100 }, () => makeBug({ severity: 'critical' }));
        expect(calculateScore(bugs)).toBeGreaterThanOrEqual(0);
    });

    it('penalizes critical bugs more than minor bugs', () => {
        const criticalScore = calculateScore([makeBug({ severity: 'critical' })]);
        const minorScore = calculateScore([makeBug({ severity: 'minor' })]);
        expect(criticalScore).toBeLessThan(minorScore);
    });
});

describe('deduplicateBugs', () => {
    it('removes duplicate bugs with same code, message and selector', () => {
        const bug = makeBug({ code: 'TYPO', message: 'Typo found', selector: 'p' });
        const duplicate = { ...bug, id: crypto.randomUUID() };
        const result = deduplicateBugs([bug, duplicate]);
        expect(result).toHaveLength(1);
    });

    it('keeps bugs with different codes', () => {
        const bug1 = makeBug({ code: 'TYPO', message: 'Something' });
        const bug2 = makeBug({ code: 'LAYOUT_OVERFLOW', message: 'Something' });
        expect(deduplicateBugs([bug1, bug2])).toHaveLength(2);
    });

    it('treats Desktop and Mobile as same bug during deduplication', () => {
        const bug1 = makeBug({ code: 'SMALL_TARGET', message: '[Desktop] Element too small' });
        const bug2 = makeBug({ code: 'SMALL_TARGET', message: '[Mobile] Element too small' });
        const result = deduplicateBugs([bug1, bug2]);
        expect(result).toHaveLength(1);
    });
});

describe('addPriorityScores', () => {
    it('adds a priorityScore to each bug', () => {
        const bugs = [makeBug({ severity: 'critical' }), makeBug({ severity: 'minor' })];
        const result = addPriorityScores(bugs);
        result.forEach(b => {
            expect(b.priorityScore).toBeDefined();
            expect(b.priorityScore).toBeGreaterThanOrEqual(0);
            expect(b.priorityScore).toBeLessThanOrEqual(100);
        });
    });

    it('gives critical bugs higher priority than minor bugs', () => {
        const critical = makeBug({ severity: 'critical', code: 'NAV_SERVER_ERROR' });
        const minor = makeBug({ severity: 'minor', code: 'TYPO' });
        const [scoredCritical, scoredMinor] = addPriorityScores([critical, minor]);
        expect(scoredCritical.priorityScore!).toBeGreaterThan(scoredMinor.priorityScore!);
    });
});

describe('limitAndTagBugs', () => {
    it('limits bugs to the specified count', () => {
        const bugs = Array.from({ length: 20 }, () => makeBug());
        expect(limitAndTagBugs(bugs, 'Desktop', 'https://example.com', 5)).toHaveLength(5);
    });

    it('prepends viewport label to message', () => {
        const bug = makeBug({ message: 'Element overflows' });
        const [tagged] = limitAndTagBugs([bug], 'Mobile', 'https://example.com', 10);
        expect(tagged.message).toBe('[Mobile] Element overflows');
    });

    it('sets pageUrl on each bug', () => {
        const bug = makeBug();
        const [tagged] = limitAndTagBugs([bug], 'Desktop', 'https://test.com', 10);
        expect(tagged.pageUrl).toBe('https://test.com');
    });

    it('appends viewport to locationDescription if present', () => {
        const bug = makeBug({ locationDescription: 'Header nav' });
        const [tagged] = limitAndTagBugs([bug], 'Tablet', 'https://example.com', 10);
        expect(tagged.locationDescription).toBe('Header nav (Tablet)');
    });
});

describe('groupAccessibilityBugs', () => {
    it('groups A11Y_REGION bugs into a single summary', () => {
        const bugs = Array.from({ length: 3 }, () =>
            makeBug({ code: 'A11Y_REGION', severity: 'minor', message: 'Region missing' })
        );
        const result = groupAccessibilityBugs(bugs);
        const regionBugs = result.filter(b => b.code === 'A11Y_REGION');
        expect(regionBugs).toHaveLength(1);
        expect(regionBugs[0].message).toContain('3 occurrences');
    });

    it('leaves non-groupable bugs standalone', () => {
        const bugs = [
            makeBug({ code: 'A11Y_IMG_ALT', severity: 'major', message: 'Missing alt' }),
            makeBug({ code: 'TYPO', message: 'Mispeling' }),
        ];
        expect(groupAccessibilityBugs(bugs)).toHaveLength(2);
    });

    it('groups A11Y_LANDMARK-ONE-MAIN bugs', () => {
        const bugs = Array.from({ length: 2 }, () =>
            makeBug({ code: 'A11Y_LANDMARK-ONE-MAIN', severity: 'minor', message: 'Main missing' })
        );
        const result = groupAccessibilityBugs(bugs);
        const mainBugs = result.filter(b => b.code === 'A11Y_LANDMARK-ONE-MAIN');
        expect(mainBugs).toHaveLength(1);
    });
});
