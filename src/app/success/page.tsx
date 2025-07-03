"use client";
export const dynamic = "force-dynamic";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const params = useSearchParams();
  const orderId = params ? params.get("orderId") : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-8">
      <div className="bg-gray-800 p-8 rounded shadow max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold">Thank you for your purchase! 🎉</h1>
        {orderId && (
          <p className="text-lg">
            Your order ID is <span className="font-mono text-green-400">{orderId}</span>
          </p>
        )}
        <p>You can view your order status and history at any time.</p>
        <Link
          href="/customer"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-semibold"
        >
          Go to Order Status
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
} 