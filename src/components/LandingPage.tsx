import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, BarChart3, Activity,Clock, Users, Shield, ArrowRight, CheckCircle, Zap, Globe, Award, TrendingUp, Cuboid as Cube, Eye, Layers, Monitor, Smartphone, Tablet } from 'lucide-react'

interface LandingPageProps {
  onGetStarted: () => void,
  onAboutUs: () => void
}

export function LandingPage({ onGetStarted, onAboutUs }: LandingPageProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  // Hero images showcasing 3D visualization and digital twin
  const heroImages = [
    'https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop', // 3D Building visualization
    'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop', // Digital construction
    'https://images.pexels.com/photos/3862365/pexels-photo-3862365.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop', // BIM modeling
    'https://images.pexels.com/photos/3861458/pexels-photo-3861458.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop', // Construction tech
  ]

  const features = [
    {
      icon: Activity,
      title: "Real-time Progress Tracking",
      description: "Monitor construction progress in real-time with P6 activity integration and live status updates"
    },
    {
      icon: Cube,
      title: "3D Progress Visualization",
      description: "See your project come to life with dynamic color-coded 3D models that reflect actual progress"
    },
    {
      icon: Clock,
      title: "P6 Schedule Integration",
      description: "Seamlessly sync with Primavera P6 activities for accurate progress percentage tracking"
    },
    {
      icon: Monitor,
      title: "Live Site Monitoring",
      description: "Connect field progress to digital models for instant visualization of construction status"
    }
  ]

  const benefits = [
    "Real-time progress visualization",
    "P6 schedule integration",
    "Color-coded element status",
    "Live field data sync",
    "Progress percentage tracking",
    "Instant status updates"
  ]

  useEffect(() => {
    setIsVisible(true)
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-red-50/30" />
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%" viewBox="0 0 1200 800">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#dc2626" strokeWidth="0.5" opacity="0.3"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        
        {/* Floating geometric shapes */}
        <motion.div
          className="absolute top-20 left-10 w-20 h-20 bg-red-500/10 rounded-lg"
          animate={{
            y: [0, -20, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-40 right-20 w-16 h-16 bg-red-600/10 rounded-full"
          animate={{
            y: [0, 30, 0],
            x: [0, -10, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-40 left-1/4 w-12 h-12 bg-red-400/10"
          style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
          animate={{
            rotate: [0, 360],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <motion.div 
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="relative">
                <motion.div 
                  className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                    <div className="w-4 h-4 bg-red-500 rounded-sm"></div>
                  </div>
                </motion.div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <span className="text-2xl font-bold text-gray-900">ROWAD</span>
                <div className="text-xs text-red-600 font-semibold -mt-1 tracking-wider">PROGRESS MONITORING</div>
              </div>
            </motion.div>
            
            <div className="hidden lg:flex items-center space-x-8">
              {[
                { name: 'HOME', action: () => {} },
                { name: 'ABOUT US', action: onAboutUs },
                { name: 'PROJECTS', action: onGetStarted },
                { name: 'DOCUMENTATION', action: () => {} },
                { name: 'SUPPORT', action: () => {} }
              ].map((item, index) => (
                <motion.button
                  key={item.name}
                  onClick={item.action}
                  className="text-gray-700 hover:text-red-600 font-medium transition-all duration-300 relative group"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ y: -2 }}
                >
                  {item.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-600 transition-all duration-300 group-hover:w-full"></span>
                </motion.button>
              ))}
            </div>

            <motion.button
              onClick={onGetStarted}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : -50 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-full text-sm font-medium mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Activity className="w-4 h-4" />
              Real-time Progress Monitoring
            </motion.div>

            <motion.h1
              className="text-6xl lg:text-7xl font-bold text-gray-900 mb-8 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              Track
              <span className="block bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
                Construction
              </span>
              <span className="block text-5xl lg:text-6xl">In Real-time</span>
            </motion.h1>

            <motion.p
              className="text-xl text-gray-600 mb-10 leading-relaxed max-w-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              Connect your P6 schedules to live 3D models. Watch as construction elements 
              change colors based on real progress percentages from the field, giving you 
              instant visual feedback on project status.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
            >
              <motion.button
                onClick={onGetStarted}
                className="group bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-10 py-4 rounded-xl font-semibold text-lg transition-all duration-300 shadow-xl hover:shadow-2xl flex items-center gap-3"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Your Journey
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
              
              <motion.button
                onClick={() => window.open('/viewer.html', '_blank')}
                className="group text-gray-700 hover:text-red-600 px-10 py-4 rounded-xl font-semibold text-lg transition-all duration-300 border-2 border-gray-300 hover:border-red-500 bg-white/50 backdrop-blur-sm flex items-center gap-3"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Eye className="w-5 h-5" />
                View Demo
              </motion.button>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-gray-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
            >
              {[
                { number: 'Real-time', label: 'Progress Updates' },
                { number: 'P6', label: 'Integration' },
                { number: '3D', label: 'Visualization' }
              ].map((stat, index) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl font-bold text-red-600 mb-2">{stat.number}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right Content - Image Carousel */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : 50 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="relative h-[600px] rounded-3xl overflow-hidden shadow-2xl">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentSlide}
                  src={heroImages[currentSlide]}
                  alt="3D Construction Visualization"
                  className="absolute inset-0 w-full h-full object-cover"
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.8 }}
                />
              </AnimatePresence>
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              
              {/* Content Overlay */}
              <div className="absolute bottom-8 left-8 right-8 text-white">
                <motion.h3
                  className="text-2xl font-bold mb-2"
                  key={`title-${currentSlide}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  {['Real-time Progress', 'P6 Integration', '3D Visualization', 'Live Monitoring'][currentSlide]}
                </motion.h3>
                <motion.p
                  className="text-white/90"
                  key={`desc-${currentSlide}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  {[
                    'See progress updates as they happen on-site',
                    'Seamlessly connect with Primavera P6 schedules',
                    'Color-coded elements show completion status',
                    'Monitor multiple projects simultaneously'
                  ][currentSlide]}
                </motion.p>
              </div>

              {/* Slide Indicators */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {heroImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === currentSlide ? 'bg-white w-8' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Floating Elements */}
            <motion.div
              className="absolute -top-4 -right-4 w-24 h-24 bg-red-500/10 rounded-2xl backdrop-blur-sm border border-red-200/20 flex items-center justify-center"
              animate={{
                y: [0, -10, 0],
                rotate: [0, 5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Cube className="w-8 h-8 text-red-500" />
            </motion.div>

            <motion.div
              className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/80 rounded-2xl backdrop-blur-sm shadow-lg flex items-center justify-center"
              animate={{
                y: [0, 10, 0],
                rotate: [0, -5, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Layers className="w-6 h-6 text-red-600" />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 py-32 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <motion.div
              className="inline-flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-full text-sm font-medium mb-6"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Zap className="w-4 h-4" />
              Core Features
            </motion.div>
            
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              How It Works
              <span className="block bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
                Progress Made Visual
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform bridges the gap between field progress and digital visualization, 
              giving you real-time insights into your construction projects.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-red-200"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, scale: 1.02 }}
              >
                <motion.div
                  className="bg-gradient-to-br from-red-500 to-red-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl"
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.6 }}
                >
                  <feature.icon className="w-8 h-8 text-white" />
                </motion.div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-red-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="relative z-10 py-32 bg-gradient-to-br from-gray-900 via-gray-800 to-red-900 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" viewBox="0 0 1200 800">
            <defs>
              <pattern id="hexagon" width="60" height="60" patternUnits="userSpaceOnUse">
                <polygon points="30,5 50,20 50,40 30,55 10,40 10,20" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hexagon)" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <motion.div
                className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full text-sm font-medium mb-8"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <TrendingUp className="w-4 h-4" />
                Key Benefits
              </motion.div>

              <h2 className="text-5xl font-bold mb-8">
                Transform How You
                <span className="block text-red-400">Monitor Progress</span>
              </h2>
              
              <p className="text-xl text-gray-300 mb-10 leading-relaxed">
                Get instant visibility into project status with our real-time 3D progress 
                monitoring platform that connects field updates to visual models.
              </p>
              
              <div className="space-y-6">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={benefit}
                    className="flex items-center gap-4"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <motion.div
                      className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0"
                      whileHover={{ scale: 1.2 }}
                    >
                      <CheckCircle className="w-4 h-4 text-white" />
                    </motion.div>
                    <span className="text-lg text-gray-200">{benefit}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="grid grid-cols-2 gap-8">
                {[
                  { icon: Activity, text: 'Real-time', label: 'Updates', color: 'from-green-400 to-green-600' },
                  { icon: Clock, text: 'Instant', label: 'Sync', color: 'from-blue-400 to-blue-600' },
                  { icon: Eye, text: 'Visual', label: 'Progress', color: 'from-purple-400 to-purple-600' },
                  { icon: Monitor, text: '3D', label: 'Monitoring', color: 'from-red-400 to-red-600' }
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/20"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ scale: 1.05, y: -5 }}
                  >
                    <motion.div
                      className={`bg-gradient-to-br ${stat.color} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                    >
                      <stat.icon className="w-8 h-8 text-white" />
                    </motion.div>
                    <div className="text-3xl font-bold mb-2">{stat.text}</div>
                    <div className="text-gray-300">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative z-10 py-32 bg-gradient-to-r from-red-500 to-red-600 text-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <motion.div
              className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium mb-8"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Zap className="w-4 h-4" />
              Ready to Transform?
            </motion.div>

            <h2 className="text-5xl font-bold mb-8">
              Start Your Digital
              <span className="block">Construction Journey</span>
            </h2>
            
            <p className="text-xl text-red-100 mb-12 max-w-2xl mx-auto leading-relaxed">
              Connect your P6 schedules and see your projects come to life with real-time 
              3D progress visualization. Get started today.
            </p>
            
            <motion.button
              onClick={onGetStarted}
              className="group bg-white text-red-600 px-12 py-4 rounded-xl font-bold text-xl transition-all duration-300 shadow-xl hover:shadow-2xl flex items-center gap-3 mx-auto"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              Begin Your Journey
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              className="flex justify-center items-center gap-4 mb-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-red-500 rounded-sm"></div>
                </div>
              </div>
              <div>
                <span className="text-2xl font-bold text-white">ROWAD</span>
                <div className="text-sm text-red-400 font-semibold -mt-1 tracking-wider">MODERN ENGINEERING</div>
              </div>
            </motion.div>
            
            <motion.p
              className="text-gray-400 mb-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
            >
              © 2025 Rowad Modern Engineering. All rights reserved.
            </motion.p>

            <motion.div
              className="flex justify-center gap-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
            >
              {['Privacy Policy', 'Terms of Service', 'Contact Us'].map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  {link}
                </a>
              ))}
            </motion.div>
          </div>
        </div>
      </footer>
    </div>
  )
}