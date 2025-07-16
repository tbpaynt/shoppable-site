"use client";
import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "How do I place an order?",
    answer: "Browse our products, add items to your cart, and proceed to checkout. You'll need to create an account or sign in to complete your purchase."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards (Visa, MasterCard, American Express, Discover) and PayPal. All payments are processed securely through Stripe."
  },
  {
    question: "How long does shipping take?",
    answer: "Standard shipping takes 5-7 business days, express shipping takes 2-3 business days, and overnight shipping delivers the next business day. Orders over $50 qualify for free standard shipping."
  },
  {
    question: "How do I track my order?",
    answer: "You'll receive a tracking number via email once your order ships. You can also check your order status in your account dashboard."
  },
  {
    question: "Do you ship internationally?",
    answer: "Currently, we only ship within the United States and its territories. International shipping is not available at this time."
  },
  {
    question: "What if my package is damaged?",
    answer: "If your package arrives damaged, please contact us immediately with photos. We'll help you file a claim or arrange a replacement."
  },
  {
    question: "How can I contact customer service?",
    answer: "You can reach us by email at support@ktwholesalefinds.com, by phone at (555) 123-4567, or through our contact form on the website."
  },
  {
    question: "Are your prices really wholesale?",
    answer: "Yes! We work directly with manufacturers and suppliers to cut out the middleman and pass the savings directly to our customers."
  },
  {
    question: "How do I create an account?",
    answer: "Click the 'Sign Up' button in the top navigation. You can create an account using your email address or sign up with Google."
  },
  {
    question: "Is my personal information secure?",
    answer: "Yes, we take security seriously. All personal and payment information is encrypted and protected using industry-standard security measures."
  }
];

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index);
    } else {
      newOpenItems.add(index);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pt-16">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 text-center">Frequently Asked Questions</h1>
        
        <div className="bg-gray-800 rounded-lg p-8">
          <p className="text-gray-300 mb-8 text-center">
            Can't find what you're looking for? <a href="/contact" className="text-blue-400 hover:text-blue-300 underline">Contact us</a> and we'll be happy to help!
          </p>
          
          <div className="space-y-4">
            {faqData.map((item, index) => (
              <div key={index} className="border border-gray-700 rounded-lg">
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-700 transition-colors"
                >
                  <span className="font-semibold">{item.question}</span>
                  <svg
                    className={`w-5 h-5 transition-transform ${openItems.has(index) ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openItems.has(index) && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-300">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-blue-900 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">Still Have Questions?</h2>
          <p className="text-gray-300 mb-6">
            Our customer service team is here to help with any questions not covered above.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="/contact" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Contact Us
            </a>
            <a 
              href="mailto:support@ktwholesalefinds.com" 
              className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              Email Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 