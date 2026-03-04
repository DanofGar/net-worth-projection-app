/**
 * Gate 15: Component Tests
 *
 * Focuses on self-contained components that are testable in jsdom.
 * The large 'use client' pages (dashboard, rules) depend on useRouter,
 * Supabase browser client, fetch, Recharts canvas APIs, and framer-motion
 * animations — the combination makes reliable rendering in jsdom impractical
 * without an extensive mock surface that would test the mocks rather than
 * the component. Toast is self-contained and exercises the global singleton
 * pattern directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock framer-motion to avoid animation side-effects in jsdom
// ---------------------------------------------------------------------------
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...rest}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { toast, ToastContainer } from '@/app/components/Toast';

// ---------------------------------------------------------------------------
// ToastContainer / toast()
// ---------------------------------------------------------------------------

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing and shows no toasts initially', () => {
    render(<ToastContainer />);
    // No toast messages visible yet
    expect(screen.queryByText(/./)).toBeNull();
  });

  it('displays a success toast when toast("success", ...) is called', async () => {
    render(<ToastContainer />);

    await act(async () => {
      toast('success', 'Account connected successfully');
    });

    expect(screen.getByText('Account connected successfully')).toBeInTheDocument();
  });

  it('applies success styling to a success toast', async () => {
    render(<ToastContainer />);

    await act(async () => {
      toast('success', 'Saved!');
    });

    const toastEl = screen.getByText('Saved!');
    // Parent div carries the color classes
    expect(toastEl.className).toMatch(/green/);
  });

  it('displays an error toast when toast("error", ...) is called', async () => {
    render(<ToastContainer />);

    await act(async () => {
      toast('error', 'Something went wrong');
    });

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('applies error styling to an error toast', async () => {
    render(<ToastContainer />);

    await act(async () => {
      toast('error', 'Failed to load');
    });

    const toastEl = screen.getByText('Failed to load');
    expect(toastEl.className).toMatch(/red/);
  });

  it('renders multiple toasts at once', async () => {
    render(<ToastContainer />);

    await act(async () => {
      toast('success', 'First message');
      toast('error', 'Second message');
    });

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('removes a toast after 4 seconds', async () => {
    render(<ToastContainer />);

    await act(async () => {
      toast('success', 'Temporary toast');
    });

    expect(screen.getByText('Temporary toast')).toBeInTheDocument();

    // Advance fake timers past the 4000ms auto-dismiss window and flush React state
    act(() => {
      vi.advanceTimersByTime(4001);
    });

    // After timers fire and React re-renders, the toast should be gone
    expect(screen.queryByText('Temporary toast')).toBeNull();
  });

  it('clears the global addToastFn on unmount', async () => {
    const { unmount } = render(<ToastContainer />);

    await act(async () => {
      toast('success', 'Before unmount');
    });

    unmount();

    // Calling toast after unmount should not throw — addToastFn is null
    expect(() => toast('success', 'After unmount')).not.toThrow();
  });
});
