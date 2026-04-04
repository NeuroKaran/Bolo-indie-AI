import { jest } from '@jest/globals';
import { fallbackStructure } from '../promptService';

describe('fallbackStructure', () => {
    test('should return a basic structure for a normal transcript', () => {
        const transcript = 'This is a title. This is a requirement. This is another one!';
        const result = fallbackStructure(transcript);

        expect(result.title).toBe('This is a title');
        expect(result.summary).toBe(transcript);
        expect(result.requirements).toEqual(['This is a requirement', 'This is another one']);
        expect(result.acceptance_criteria).toEqual([]);
        expect(result.constraints).toEqual([]);
        expect(result.examples).toEqual([]);
    });

    test('should handle empty transcript', () => {
        const result = fallbackStructure('');
        expect(result.title).toBe('Voice Prompt');
        expect(result.summary).toBe('');
        expect(result.requirements).toEqual([]);
    });

    test('should handle transcript with only whitespace', () => {
        const result = fallbackStructure('   ');
        expect(result.title).toBe('Voice Prompt');
        expect(result.summary).toBe('   ');
        expect(result.requirements).toEqual([]);
    });

    test('should handle transcript with no punctuation (single sentence)', () => {
        const transcript = 'This is a single long sentence without any punctuation';
        const result = fallbackStructure(transcript);

        expect(result.title).toBe(transcript);
        expect(result.summary).toBe(transcript);
        expect(result.requirements).toEqual([]);
    });

    test('should truncate long title to 60 characters', () => {
        const longFirstSentence = 'This is a very very very very very very very very very very very long first sentence that should be truncated';
        const transcript = `${longFirstSentence}. Next sentence.`;
        const result = fallbackStructure(transcript);

        expect(result.title.length).toBe(60);
        expect(result.title).toBe(longFirstSentence.slice(0, 60));
        expect(result.requirements).toContain('Next sentence');
    });

    test('should truncate summary to 200 characters', () => {
        const longTranscript = 'A'.repeat(250);
        const result = fallbackStructure(longTranscript);

        expect(result.summary.length).toBe(200);
        expect(result.summary).toBe('A'.repeat(200));
    });

    test('should handle multiple types of punctuation', () => {
        const transcript = 'Wait! What? Oh, I see.';
        const result = fallbackStructure(transcript);

        expect(result.title).toBe('Wait');
        expect(result.requirements).toEqual(['What', 'Oh, I see']);
    });

    test('should handle multiple consecutive punctuation marks', () => {
        const transcript = 'Hello... World!!! How are you??';
        const result = fallbackStructure(transcript);

        expect(result.title).toBe('Hello');
        expect(result.requirements).toEqual(['World', 'How are you']);
    });

    test('should filter out empty strings from requirements', () => {
        const transcript = 'Title. . Requirement 1. . Requirement 2.';
        const result = fallbackStructure(transcript);

        expect(result.title).toBe('Title');
        expect(result.requirements).toEqual(['Requirement 1', 'Requirement 2']);
    });

    test('should handle transcript starting with punctuation', () => {
        const transcript = '... Oops. First real sentence.';
        const result = fallbackStructure(transcript);

        expect(result.title).toBe('Oops');
        expect(result.requirements).toEqual(['First real sentence']);
    });
});
