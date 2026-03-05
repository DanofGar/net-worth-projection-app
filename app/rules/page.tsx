'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createBrowserClient } from '@/lib/supabase';
import { toast } from '@/app/components/Toast';
import { format, parseISO, addWeeks, addMonths } from 'date-fns';

interface RecurringRule {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'once';
  anchor_date: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
}

export default function RulesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    frequency: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'once',
    anchor_date: '',
    end_date: '',
    active: true,
  });

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  async function checkAuthAndFetch() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    fetchRules();
  }

  async function fetchRules() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/rules');
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(`Failed to fetch rules: ${response.status}`);
      }
      const data: RecurringRule[] = await response.json();
      setRules(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load rules';
      toast('error', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingRule(null);
    setFormData({
      name: '',
      amount: '',
      frequency: 'monthly',
      anchor_date: '',
      end_date: '',
      active: true,
    });
    setShowModal(true);
  }

  function openEditModal(rule: RecurringRule) {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      amount: rule.amount.toString(),
      frequency: rule.frequency,
      anchor_date: rule.anchor_date,
      end_date: rule.end_date || '',
      active: rule.active,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingRule(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount === 0) {
      setError('Amount must be a non-zero number');
      return;
    }

    const payload = {
      name: formData.name,
      amount,
      frequency: formData.frequency,
      anchor_date: formData.anchor_date,
      end_date: formData.end_date || null,
      active: formData.active,
    };

    try {
      const url = editingRule ? `/api/rules/${editingRule.id}` : '/api/rules';
      const method = editingRule ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${editingRule ? 'update' : 'create'} rule`);
      }

      closeModal();
      fetchRules();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save rule';
      toast('error', msg);
      setError(msg);
    }
  }

  async function handleDelete(id: string) {
    try {
      const response = await fetch(`/api/rules/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete rule');
      }

      setConfirmDeleteId(null);
      fetchRules();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete rule';
      toast('error', msg);
      setError(msg);
    }
  }

  async function handleToggleActive(rule: RecurringRule) {
    try {
      const response = await fetch(`/api/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !rule.active }),
      });

      if (!response.ok) {
        throw new Error('Failed to update rule');
      }

      fetchRules();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update rule';
      toast('error', msg);
      setError(msg);
    }
  }

  function calculateNextOccurrence(rule: RecurringRule): string {
    const anchor = parseISO(rule.anchor_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (rule.frequency === 'once') {
      return anchor >= today ? format(anchor, 'MMM d, yyyy') : 'Past';
    }

    let next: Date;
    const daysDiff = Math.floor((today.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));

    switch (rule.frequency) {
      case 'weekly': {
        const periods = Math.ceil(daysDiff / 7);
        next = addWeeks(anchor, periods);
        break;
      }
      case 'biweekly': {
        const periods = Math.ceil(daysDiff / 14);
        next = addWeeks(anchor, periods * 2);
        break;
      }
      case 'monthly': {
        next = addMonths(anchor, Math.ceil(daysDiff / 30));
        // Adjust: addMonths may undershoot, advance one more if still in past
        while (next < today) next = addMonths(next, 1);
        break;
      }
      default:
        return 'Unknown';
    }

    if (rule.end_date && next > parseISO(rule.end_date)) {
      return 'Ended';
    }

    return format(next, 'MMM d, yyyy');
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-body text-charcoal/60">Loading rules...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center font-body text-charcoal/70 hover:text-charcoal transition-colors mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-terra rounded"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
            <h1 className="font-heading text-5xl text-charcoal">Recurring Rules</h1>
          </div>
          <button
            onClick={openAddModal}
            className="bg-terra text-white px-6 py-2 rounded-lg font-body hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-terra"
          >
            + Add Rule
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 font-body">
            {error}
          </div>
        )}

        {/* Rules List */}
        {rules.length === 0 ? (
          <div className="bg-white border border-border-subtle rounded-lg p-12 text-center">
            <h2 className="font-heading text-2xl text-charcoal mb-4">
              No recurring rules yet
            </h2>
            <p className="font-body text-charcoal/60 mb-8">
              Add your first rule to see projections change.
            </p>
            <button
              onClick={openAddModal}
              className="bg-terra text-white px-8 py-3 rounded-lg font-body hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-terra"
            >
              Add Your First Rule
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {rules.map((rule, index) => (
                <motion.div
                  key={rule.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, overflow: 'hidden' }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white rounded-lg p-6 shadow-sm border-l-4 ${
                    rule.amount >= 0
                      ? 'border-l-green-500 border border-l-green-500 border-t-border-subtle border-r-border-subtle border-b-border-subtle'
                      : 'border-l-red-500 border border-l-red-500 border-t-border-subtle border-r-border-subtle border-b-border-subtle'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-body text-lg text-charcoal font-medium">
                          {rule.name}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-xs font-body ${
                            rule.active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {rule.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm font-body text-charcoal/60 mb-2">
                        <span>
                          <span className={rule.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(rule.amount)}
                          </span>
                          {' '}
                          {rule.frequency === 'once' ? 'once' : `every ${rule.frequency === 'biweekly' ? '2 weeks' : rule.frequency}`}
                        </span>
                        <span>•</span>
                        <span>Next: {calculateNextOccurrence(rule)}</span>
                      </div>
                      <p className="text-xs font-body text-charcoal/50">
                        Started: {format(parseISO(rule.anchor_date), 'MMM d, yyyy')}
                        {rule.end_date && ` • Ends: ${format(parseISO(rule.end_date), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.active}
                          onChange={() => handleToggleActive(rule)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-terra rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-terra"></div>
                      </label>
                      <button
                        onClick={() => openEditModal(rule)}
                        className="px-3 py-1 text-sm font-body text-charcoal/70 hover:text-charcoal border border-border-subtle rounded hover:bg-cream transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terra"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(rule.id)}
                        className="px-3 py-1 text-sm font-body text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {confirmDeleteId === rule.id && (
                    <div className="mt-4 pt-4 border-t border-border-subtle">
                      <p className="font-body text-sm text-charcoal mb-2">Delete this rule permanently?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 px-3 py-1.5 border border-border-subtle rounded font-body text-sm text-charcoal hover:bg-cream transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terra"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded font-body text-sm hover:bg-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {showModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeModal}
                className="fixed inset-0 bg-black/50 z-40"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="font-heading text-2xl text-charcoal mb-6">
                    {editingRule ? 'Edit Rule' : 'Add New Rule'}
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block font-body text-sm text-charcoal mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-sm text-charcoal mb-1">
                        Amount
                        <span className="text-charcoal/50 ml-2">
                          (Use negative for expenses)
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-sm text-charcoal mb-1">
                        Frequency
                      </label>
                      <select
                        value={formData.frequency}
                        onChange={(e) => setFormData({ ...formData, frequency: e.target.value as RecurringRule['frequency'] })}
                        required
                        className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="once">Once</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-body text-sm text-charcoal mb-1">
                        Start Date
                      </label>
                      <div
                        className="cursor-pointer"
                        onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker()}
                      >
                        <input
                          type="date"
                          value={formData.anchor_date}
                          onChange={(e) => setFormData({ ...formData, anchor_date: e.target.value })}
                          required
                          className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra cursor-pointer"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-body text-sm text-charcoal mb-1">
                        End Date (Optional)
                      </label>
                      <div
                        className="cursor-pointer"
                        onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker()}
                      >
                        <input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                          className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="active"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="w-4 h-4 text-terra border-border-subtle rounded focus:ring-terra"
                      />
                      <label htmlFor="active" className="font-body text-sm text-charcoal">
                        Active
                      </label>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="flex-1 px-4 py-2 border border-border-subtle rounded-lg font-body text-charcoal hover:bg-cream transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terra"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-terra text-white rounded-lg font-body hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-terra"
                      >
                        {editingRule ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
