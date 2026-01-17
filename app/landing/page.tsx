'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream overflow-hidden relative">
      {/* Animated Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 right-10 w-64 h-64 rounded-full bg-terra/10"
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-32 left-10 w-48 h-48 rounded-full bg-charcoal/5"
          animate={{
            y: [0, 15, 0],
            x: [0, -10, 0],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/4 w-32 h-32 rounded-full bg-terra/5"
          animate={{
            y: [0, -10, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-8 py-16">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          className="text-center mb-24"
        >
          <h1 className="font-heading text-6xl md:text-7xl lg:text-8xl text-charcoal mb-6 leading-tight">
            See Your Financial
            <br />
            <span className="text-terra">Future, 60 Days Ahead</span>
          </h1>
          <p className="font-body text-xl md:text-2xl text-charcoal/70 mb-12 max-w-2xl mx-auto">
            Track your net worth and cash flow with automated balance updates.
            Make informed financial decisions with clear, 60-day projections.
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/connect"
              className="inline-block bg-terra text-white px-12 py-4 rounded-lg font-body text-lg font-medium hover:opacity-90 transition-opacity shadow-lg"
            >
              Get Started
            </Link>
          </motion.div>
        </motion.div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              title: 'Track Net Worth',
              description: 'Monitor your total and liquid net worth with projections that account for all your accounts, including retirement savings.',
              icon: (
                <svg className="w-12 h-12 text-terra" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ),
            },
            {
              title: 'Monitor Cash Flow',
              description: 'Track your primary account balance with automatic credit card payment deductions and recurring income projections.',
              icon: (
                <svg className="w-12 h-12 text-terra" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
            {
              title: 'Automated Updates',
              description: 'Your account balances sync automatically three times daily, so your projections always reflect the latest data.',
              icon: (
                <svg className="w-12 h-12 text-terra" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ),
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.35 + index * 0.15 }}
              className="bg-white border border-border-subtle rounded-lg p-8 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="font-heading text-2xl text-charcoal mb-3">
                {feature.title}
              </h3>
              <p className="font-body text-charcoal/70 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Simple Chart Illustration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-24 max-w-3xl mx-auto"
        >
          <div className="bg-white border border-border-subtle rounded-lg p-8 shadow-sm">
            <div className="flex items-end justify-between h-48 gap-2">
              {[65, 72, 68, 75, 80, 85, 90].map((height, index) => (
                <motion.div
                  key={index}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.6, delay: 1 + index * 0.1 }}
                  className="flex-1 bg-terra rounded-t"
                />
              ))}
            </div>
            <p className="text-center font-body text-sm text-charcoal/60 mt-4">
              Projected growth over 60 days
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
