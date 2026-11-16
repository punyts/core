import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createReporter,
} from './Reporter.js';
import type { ListenerFn, Reporter } from './types.js';

describe('Reporter Utility', () => {
    let reporter: Reporter;
    let setCategories: Reporter['setCategories'];
    let addListener: Reporter['addListener'];
    let removeListener: Reporter['removeListener'];
    let report: Reporter['report'];

    beforeEach(() => {
        reporter = createReporter();
        setCategories = reporter.setCategories;
        addListener = reporter.addListener;
        removeListener = reporter.removeListener;
        report = reporter.report;
        // Reset categories and listeners before each test
        setCategories(['info', 'error', 'stack']);
    });

    it('setCategories should set categories correctly', () => {
        setCategories('warning');
        expect(report.warning).toBeDefined();

        setCategories(['info', 'log']);
        expect(report.info).toBeDefined();
        expect(report.log).toBeDefined();
    });

    it('should handle a string categories arg when adding listener', () => {
    const mockListener: ListenerFn = vi.fn();
        addListener(mockListener, 'error');
        report.error("error message");
        expect(mockListener).toHaveBeenCalled();
    });

    it('should handle missing categories when adding listeners', () => {
    const mockListener: ListenerFn = vi.fn();
        addListener(mockListener);
        report.error("error message");
        expect(mockListener).toHaveBeenCalled();
    });

    it('should throw error if listener not a function', () => {
        let error: any;
        try {
            addListener(undefined as unknown as ListenerFn, 'info');
        }
        catch (err) {
            error = err;
        }
        expect(error).not.toBeUndefined();
    });

    it("should swallow error from listener handler", () => {
        // Mock console.error for this test only
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => { });

    const mockListener: ListenerFn = vi.fn(() => { throw new Error("Listener error") });
        addListener(mockListener, 'info');
        report.info("Test message");
        removeListener(mockListener, 'info');
        // Assert that console.error was called
    expect(console.error).toHaveBeenCalledWith(expect.any(Error));
    expect((consoleErrorMock.mock.calls[0][0] as Error).message).toBe('Listener error');

    consoleErrorMock.mockRestore();
    });

    it("should do nothing if the categories don't match", () => {
    const mockListener: ListenerFn = vi.fn();
        addListener(mockListener, 'all');
        report("event", "This message should not emit");
        expect(mockListener).not.toHaveBeenCalled();
    });

    it('should handle details as a function', () => {
    const details = vi.fn();
    const mockListener: ListenerFn = vi.fn();
        addListener(mockListener, 'info');

        report.info('Test message', details);
        expect(mockListener).toHaveBeenCalled();
        expect(details).toHaveBeenCalled();
    });

    it('should handle a non-string message', () => {
    const mockListener = vi.fn();
        addListener(mockListener as ListenerFn, 'info');

        report.info({ message: "test" } as unknown as string);
        expect(mockListener).toHaveBeenCalledWith(expect.any(Number), "info", "{\"message\":\"test\"}", undefined);

        const circularObject: any = {};
        circularObject.self = circularObject; // Circular reference
        report.info(circularObject as unknown as string);
        expect(mockListener).toHaveBeenNthCalledWith(2, expect.any(Number), "info", "reporter error: TypeError: Converting circular structure to JSON\n    --> starting at object with constructor 'Object'\n    --- property 'self' closes the circle", undefined)
    });

    it('should handle a details as an object', () => {
        const mockListener: ListenerFn = vi.fn();
        addListener(mockListener, 'info');

        const payload = { message: 'test' };
        report.info('An object detail should work', payload);
        expect(mockListener).toHaveBeenCalledWith(
            expect.any(Number),
            'info',
            'An object detail should work',
            payload
        );

        const circularObject: any = {};
        circularObject.self = circularObject; // Circular reference
        report.info('Circular detail retains reference', circularObject);
        expect(mockListener).toHaveBeenNthCalledWith(
            2,
            expect.any(Number),
            'info',
            'Circular detail retains reference',
            circularObject
        );
    });

    it('should snapshot details when requested', () => {
        const mockListener: ListenerFn = vi.fn();
        addListener(mockListener, 'info');

        const payload = { count: 1 };
        report.info('Snapshot payload', payload, undefined, true);

        payload.count = 2;

        const call = vi.mocked(mockListener).mock.calls[0];
        expect(call[3]).toEqual({ count: 1 });
        expect(call[3]).not.toBe(payload);

        const circularObject: any = {};
        circularObject.self = circularObject;
        report.info('Snapshot circular payload', circularObject, undefined, true);

        const secondCall = vi.mocked(mockListener).mock.calls[1];
        expect(typeof secondCall[3]).toBe('string');
        expect(secondCall[3] as string).toContain('Converting circular structure');
    });

    it('should convert %s values in the message', () => {
    const mockListener: ListenerFn = vi.fn();
        addListener(mockListener, 'info');
        report.info("Test message %s", ["worked"]);
        report.info("Test message %s", { worked: true });

        expect(mockListener).toHaveBeenCalledWith(expect.any(Number), "info", "Test message worked", ["worked"]);
        expect(mockListener).toHaveBeenNthCalledWith(2, expect.any(Number), "info", "Test message worked=true", { worked: true });
    });

    it('should report both error message and stack', () => {
    const mockListener: ListenerFn = vi.fn();
        addListener(mockListener);
        report.error(new Error("Test error"));
        expect(mockListener).toHaveBeenCalledTimes(2);
    });

    it('should removeListener correctly', () => {
    const mockListener: ListenerFn = vi.fn();
        addListener(mockListener, 'info');
        removeListener(mockListener);
        expect(mockListener).not.toHaveBeenCalled();
    });
});