import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-black border-t border-gray-800 text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:justify-between">
          <div className="mb-8 md:mb-0">
            <h3 className="text-2xl font-bold text-indigo-400">Journi</h3>
            <p className="mt-2 text-gray-500 max-w-md">
              Simplifying on-chain trade tracking, turning blockchain complexity into clear, actionable insights.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-3 text-gray-300">Quick Links</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-500 hover:text-indigo-300 transition">Privacy Policy</a></li>
              <li><a href="#" className="text-gray-500 hover:text-indigo-300 transition">Terms of Service</a></li>
              <li><a href="#" className="text-gray-500 hover:text-indigo-300 transition">Contact Us</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-600">
          <p>© {new Date().getFullYear()} Journi. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 