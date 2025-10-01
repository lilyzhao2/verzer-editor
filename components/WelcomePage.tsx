'use client';

import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { 
  Heart, 
  Lightbulb, 
  Zap, 
  Shield, 
  Mail, 
  HelpCircle, 
  FileText, 
  Lock, 
  Eye, 
  EyeOff,
  ChevronDown,
  ChevronUp,
  Camera,
  Send
} from 'lucide-react';

export function WelcomePage() {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [isReportingBug, setIsReportingBug] = useState(false);

  const handleBugReport = async () => {
    if (!bugDescription.trim()) {
      alert('Please describe the bug before reporting.');
      return;
    }

    setIsReportingBug(true);
    
    try {
      // Take a screenshot of the current page
      const canvas = await html2canvas(document.body, {
        height: window.innerHeight,
        width: window.innerWidth,
        useCORS: true,
        allowTaint: true
      });
      
      const screenshotDataUrl = canvas.toDataURL('image/png');
      
      // Create email content
      const subject = `Bug Report - Welcome Page`;
      const body = `Bug Description: ${bugDescription}\n\nPage: Welcome Page\nTimestamp: ${new Date().toISOString()}\n\nScreenshot attached.`;
      
      // Create mailto link with screenshot as attachment (this will open email client)
      const mailtoLink = `mailto:info@verzer.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // For now, we'll copy the screenshot to clipboard and open email
      // In a real implementation, you'd want to use a proper email service
      await navigator.clipboard.writeText(screenshotDataUrl);
      
      window.open(mailtoLink);
      
      setBugDescription('');
      alert('Screenshot copied to clipboard! Please paste it into your email.');
    } catch (error) {
      console.error('Error taking screenshot:', error);
      // Fallback: just open email without screenshot
      const subject = `Bug Report - Welcome Page`;
      const body = `Bug Description: ${bugDescription}\n\nPage: Welcome Page\nTimestamp: ${new Date().toISOString()}`;
      const mailtoLink = `mailto:info@verzer.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink);
    } finally {
      setIsReportingBug(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        {/* Main Welcome Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              Welcome to Verzer! 🎉
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Thank you for being an early user! Your support means the world to us.
            </p>
          </div>

          {/* Mission Statement */}
          <div className="px-8 py-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center justify-center gap-2">
                <Lightbulb className="w-6 h-6 text-yellow-500" />
                Our Mission
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">
                My passion is to help people <strong>think and write better and faster</strong>. 
                With Verzer, you have complete control over what's working well and what isn't - 
                so you can focus on creating your best work without losing good ideas along the way.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-6 bg-blue-50 rounded-xl">
                <Zap className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-800 mb-2">AI-Powered Writing</h3>
                <p className="text-sm text-gray-600">Get intelligent suggestions and improvements for your writing</p>
              </div>
              <div className="text-center p-6 bg-purple-50 rounded-xl">
                <FileText className="w-8 h-8 text-purple-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-800 mb-2">Version Control</h3>
                <p className="text-sm text-gray-600">Never lose good writing with smart version management</p>
              </div>
              <div className="text-center p-6 bg-green-50 rounded-xl">
                <Shield className="w-8 h-8 text-green-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-800 mb-2">Your Control</h3>
                <p className="text-sm text-gray-600">You decide what to keep, change, or discard</p>
              </div>
            </div>

            {/* Bug Reporting Section */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-red-800 mb-3 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Found a Bug?
              </h3>
              <p className="text-red-700 mb-4">
                We'd appreciate you taking a screenshot and sending it to us! 
                This helps us fix issues faster.
              </p>
              <div className="space-y-3">
                <textarea
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                  placeholder="Describe what went wrong..."
                  className="w-full p-3 border border-red-300 rounded-lg resize-none"
                  rows={3}
                />
                <button
                  onClick={handleBugReport}
                  disabled={isReportingBug || !bugDescription.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isReportingBug ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Taking Screenshot...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Take Screenshot & Report
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Privacy Policy Section */}
            <div className="border border-gray-200 rounded-xl mb-8">
              <button
                onClick={() => setShowPrivacy(!showPrivacy)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
              >
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Privacy & Storage Policy
                </h3>
                {showPrivacy ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              
              {showPrivacy && (
                <div className="px-6 pb-6 border-t border-gray-200">
                  <div className="pt-4 space-y-4 text-sm text-gray-600">
                    <div className="flex items-start gap-3">
                      <Eye className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <div>
                        <strong className="text-gray-800">Can we see your content?</strong>
                        <p>No, we cannot see your documents. All data is stored locally in your browser only.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <EyeOff className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                      <div>
                        <strong className="text-gray-800">Is your content confidential?</strong>
                        <p>Yes! Your documents are stored locally in your browser. Only AI processing requests are sent to Anthropic's servers.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <Shield className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <strong className="text-gray-800">Do we train on your answers?</strong>
                        <p>No, we don't use your content to train AI models. Anthropic may use requests for model improvement, but your content stays private to you.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
                      <div>
                        <strong className="text-gray-800">Current storage system:</strong>
                        <p>All document versions, comments, and settings are stored locally in your browser's localStorage. 
                        We're working on cloud sync options for the future!</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* FAQ Section */}
            <div className="border border-gray-200 rounded-xl">
              <button
                onClick={() => setShowFAQ(!showFAQ)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
              >
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  How to Use Verzer
                </h3>
                {showFAQ ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              
              {showFAQ && (
                <div className="px-6 pb-6 border-t border-gray-200">
                  <div className="pt-4 space-y-4 text-sm text-gray-600">
                    <div>
                      <strong className="text-gray-800">1. Start Writing</strong>
                      <p>Click on the document area and start typing. Use the toolbar to format your text.</p>
                    </div>
                    
                    <div>
                      <strong className="text-gray-800">2. Create Versions</strong>
                      <p>Use "Save Version" to create checkpoints of your work. Use "Save Variation" to try different approaches.</p>
                    </div>
                    
                    <div>
                      <strong className="text-gray-800">3. Use AI Assistance</strong>
                      <p>Open the Verzer AI panel on the right to get writing suggestions and improvements.</p>
                    </div>
                    
                    <div>
                      <strong className="text-gray-800">4. Compare Versions</strong>
                      <p>Use the Compare tab to see differences between versions and merge the best parts.</p>
                    </div>
                    
                    <div>
                      <strong className="text-gray-800">5. Smart Merge</strong>
                      <p>Use the Smart Merge feature to cherry-pick the best changes from multiple versions.</p>
                    </div>
                    
                    <div>
                      <strong className="text-gray-800">6. Keyboard Shortcuts</strong>
                      <p>Use Ctrl+S to save, Ctrl+Z to undo, and various shortcuts in the Smart Merge view (A=accept, R=reject, N=next).</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feedback Section */}
            <div className="mt-8 text-center">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center justify-center gap-2">
                <Mail className="w-5 h-5" />
                Feedback & Feature Requests
              </h3>
              <p className="text-gray-600 mb-4">
                We'd love to hear your thoughts! Send us feedback and feature requests.
              </p>
              <a
                href="mailto:info@verzer.com?subject=Feedback%20%26%20Feature%20Requests"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Send className="w-4 h-4" />
                Send Feedback
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

