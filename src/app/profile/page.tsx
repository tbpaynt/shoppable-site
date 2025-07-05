"use client";
import { useSession, signIn } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import StripeProfileWrapper from "../components/StripeProfileWrapper";
import PaymentMethodSetup from "../components/PaymentMethodSetup";

type PaymentMethod = {
  id: string;
  stripe_payment_method_id: string;
  stripe_customer_id: string;
  type: string;
  last4?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  user_email: string;
};

type ShippingAddress = {
  id: string;
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_default: boolean;
  created_at: string;
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'personal' | 'payments' | 'addresses'>('personal');
  const [loading, setLoading] = useState(false);
  
  // Personal Information
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  
  // Shipping Addresses
  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    name: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US'
  });

  const loadUserData = useCallback(async () => {
    if (!session?.user?.email) return;
    
    setLoading(true);
    try {
      // Load personal info from API
      const profileResponse = await fetch('/api/profile');
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setName(profileData.name || '');
        setPhone(profileData.phone || '');
      }

      // Load shipping addresses from API
      const addressResponse = await fetch('/api/addresses');
      if (addressResponse.ok) {
        const addressData = await addressResponse.json();
        setShippingAddresses(addressData.addresses || []);
      }
      
      // Load payment methods from API
      const paymentResponse = await fetch('/api/payment-methods');
      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json();
        setPaymentMethods(paymentData.paymentMethods || []);
      }
      
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (session?.user) {
      setEmail(session.user.email || '');
      setName(session.user.name || '');
      loadUserData();
    }
  }, [session, loadUserData]);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;

    setLoading(true);
    try {
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAddress),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save address');
      }

      const data = await response.json();
      setShippingAddresses([data.address, ...shippingAddresses]);
      setNewAddress({
        name: '',
        street1: '',
        street2: '',
        city: '',
        state: '',
        zip: '',
        country: 'US'
      });
      setShowAddAddress(false);
    } catch (error) {
      console.error('Error adding address:', error);
      alert('Failed to save address. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/addresses?id=${addressId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete address');
      }

      setShippingAddresses(shippingAddresses.filter(addr => addr.id !== addressId));
    } catch (error) {
      console.error('Error deleting address:', error);
      alert('Failed to delete address. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;

    setLoading(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, phone }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const data = await response.json();
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodSuccess = (paymentMethod: any) => {
    setPaymentMethods([paymentMethod, ...paymentMethods]);
    setShowAddPayment(false);
    loadUserData(); // Refresh the list
  };

  const deletePaymentMethod = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/payment-methods?id=${paymentMethodId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove payment method');
      }

      setPaymentMethods(paymentMethods.filter(pm => pm.id !== paymentMethodId));
    } catch (error) {
      console.error('Error removing payment method:', error);
      alert('Failed to remove payment method. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <h1 className="text-2xl font-bold mb-4">Please Sign In</h1>
        <p className="text-gray-600 mb-6">You need to be logged in to view your profile.</p>
        <button
          onClick={() => signIn()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <StripeProfileWrapper>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>
        
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('personal')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'personal'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Personal Information
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'payments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Payment Methods
              </button>
              <button
                onClick={() => setActiveTab('addresses')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'addresses'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Shipping Addresses
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Personal Information Tab */}
            {activeTab === 'personal' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
                <form onSubmit={handlePersonalInfoSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            )}

            {/* Payment Methods Tab */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">Payment Methods</h2>
                  <button
                    onClick={() => setShowAddPayment(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Payment Method
                  </button>
                </div>
                
                {paymentMethods.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <p>No payment methods saved</p>
                    <p className="text-sm">Add a payment method to make checkout faster</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentMethods.map((method) => (
                      <div key={method.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <div className="bg-gray-100 p-2 rounded">
                            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">•••• •••• •••• {method.last4}</p>
                            <p className="text-sm text-gray-500">{method.brand?.toUpperCase()} • Expires {method.exp_month?.toString().padStart(2, '0')}/{method.exp_year}</p>
                          </div>
                          {method.is_default && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Default</span>
                          )}
                        </div>
                        <button 
                          onClick={() => deletePaymentMethod(method.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Payment Method Form */}
                {showAddPayment && (
                  <PaymentMethodSetup
                    onSuccess={handlePaymentMethodSuccess}
                    onCancel={() => setShowAddPayment(false)}
                    isLoading={loading}
                    setIsLoading={setLoading}
                  />
                )}
              </div>
            )}

            {/* Shipping Addresses Tab */}
            {activeTab === 'addresses' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">Shipping Addresses</h2>
                  <button
                    onClick={() => setShowAddAddress(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Address
                  </button>
                </div>

                {/* Add Address Form */}
                {showAddAddress && (
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h3 className="text-lg font-medium mb-4">Add New Address</h3>
                    <form onSubmit={handleAddAddress} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={newAddress.name}
                          onChange={(e) => setNewAddress({...newAddress, name: e.target.value})}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                        <input
                          type="text"
                          value={newAddress.street1}
                          onChange={(e) => setNewAddress({...newAddress, street1: e.target.value})}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2 (Optional)</label>
                        <input
                          type="text"
                          value={newAddress.street2}
                          onChange={(e) => setNewAddress({...newAddress, street2: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          value={newAddress.city}
                          onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                          type="text"
                          value={newAddress.state}
                          onChange={(e) => setNewAddress({...newAddress, state: e.target.value})}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                        <input
                          type="text"
                          value={newAddress.zip}
                          onChange={(e) => setNewAddress({...newAddress, zip: e.target.value})}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                        <select
                          value={newAddress.country}
                          onChange={(e) => setNewAddress({...newAddress, country: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="US">United States</option>
                          <option value="CA">Canada</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 flex gap-3">
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {loading ? 'Saving...' : 'Save Address'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddAddress(false)}
                          className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Address List */}
                {shippingAddresses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p>No shipping addresses saved</p>
                    <p className="text-sm">Add an address to speed up checkout</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {shippingAddresses.map((address) => (
                      <div key={address.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium">{address.name}</h3>
                              {address.is_default && (
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Default</span>
                              )}
                            </div>
                            <p className="text-gray-600">{address.street1}</p>
                            {address.street2 && <p className="text-gray-600">{address.street2}</p>}
                            <p className="text-gray-600">{address.city}, {address.state} {address.zip}</p>
                            <p className="text-gray-600">{address.country}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                            <button 
                              onClick={() => deleteAddress(address.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </StripeProfileWrapper>
  );
} 