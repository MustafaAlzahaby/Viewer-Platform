import React from 'react'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  Building2, 
  Code, 
  Users, 
  Award,
  Briefcase,
  GraduationCap,
  MapPin,
  Mail,
  Calendar,
  Layers,
  Activity,
  Monitor
} from 'lucide-react'

interface AboutUsProps {
  onBack: () => void
}

export function AboutUs({ onBack }: AboutUsProps) {
  const teamMembers = [
    {
      name: "Mustafa Alzahaby",
      role: "Lead AEC Developer & BIM Specialist",
      image: "/api/placeholder/400/400", // You can replace with actual photos
      bio: "Mustafa is a seasoned AEC (Architecture, Engineering, Construction) developer with extensive experience in Building Information Modeling (BIM) and construction technology. He specializes in creating digital solutions that bridge the gap between traditional construction practices and modern technology.",
      expertise: [
        "BIM Development & Implementation",
        "Autodesk Platform Development",
        "Construction Workflow Optimization",
        "3D Model Integration",
        "Project Management Systems"
      ],
      experience: "8+ years",
      location: "Cairo, Egypt",
      education: "Civil Engineering, Construction Management",
      projects: [
        "Real-time Progress Monitoring Systems",
        "BIM Model Integration Platforms",
        "Construction Data Analytics Tools",
        "3D Visualization Applications"
      ]
    },
    {
      name: "Ahmed Youssry",
      role: "Senior BIM Developer & Technology Architect",
      image: "/api/placeholder/400/400", // You can replace with actual photos
      bio: "Ahmed brings deep technical expertise in BIM development and construction technology architecture. His focus on innovation has led to the creation of cutting-edge solutions for real-time project monitoring and progress visualization in the construction industry.",
      expertise: [
        "BIM Software Development",
        "Real-time Data Integration",
        "Construction Technology Architecture", 
        "P6 Schedule Integration",
        "3D Visualization Engines"
      ],
      experience: "7+ years",
      location: "Cairo, Egypt", 
      education: "Software Engineering, Construction Informatics",
      projects: [
        "P6 Integration Systems",
        "Color-coded Progress Visualization",
        "Real-time Construction Dashboards",
        "Multi-platform BIM Viewers"
      ]
    }
  ]

  const companyValues = [
    {
      icon: Activity,
      title: "Real-time Innovation",
      description: "We believe in providing instant visibility into construction progress through cutting-edge technology"
    },
    {
      icon: Building2,
      title: "Construction Focus",
      description: "Our solutions are built specifically for the construction industry's unique challenges and workflows"
    },
    {
      icon: Users,
      title: "Collaborative Approach",
      description: "We design tools that enhance collaboration between field teams, project managers, and stakeholders"
    },
    {
      icon: Monitor,
      title: "Digital Transformation",
      description: "Helping construction companies transition from traditional methods to modern digital workflows"
    }
  ]

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
      </div>

      {/* Navigation */}
      <nav className="relative z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-700 hover:text-red-600 font-medium transition-all duration-300 group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Back to Home
              </button>
            </div>
            
            <motion.div 
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: 20 }}
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
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl font-bold text-gray-900 mb-6">
              Meet Our
              <span className="block bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
                Development Team
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Passionate AEC developers and BIM specialists dedicated to revolutionizing 
              construction progress monitoring through innovative technology solutions.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Team Members Section */}
      <div className="relative z-10 py-20 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-32">
            {teamMembers.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
                className={`grid lg:grid-cols-2 gap-16 items-center ${
                  index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''
                }`}
              >
                {/* Photo */}
                <div className={`${index % 2 === 1 ? 'lg:col-start-2' : ''} relative`}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                    className="relative"
                  >
                    <div className="aspect-square rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                      {/* Placeholder for actual photo */}
                      <div className="w-32 h-32 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center">
                        <Users className="w-16 h-16 text-white" />
                      </div>
                    </div>
                    
                    {/* Floating elements */}
                    <motion.div
                      className="absolute -top-4 -right-4 w-20 h-20 bg-red-500/10 rounded-2xl backdrop-blur-sm border border-red-200/20 flex items-center justify-center"
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
                      <Code className="w-8 h-8 text-red-500" />
                    </motion.div>

                    <motion.div
                      className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/80 rounded-2xl backdrop-blur-sm shadow-lg flex items-center justify-center"
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
                      <Building2 className="w-6 h-6 text-red-600" />
                    </motion.div>
                  </motion.div>
                </div>

                {/* Content */}
                <div className={`${index % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                  <motion.div
                    initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    viewport={{ once: true }}
                  >
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-100">
                      <div className="mb-6">
                        <h3 className="text-3xl font-bold text-gray-900 mb-2">{member.name}</h3>
                        <p className="text-red-600 font-semibold text-lg">{member.role}</p>
                        
                        <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {member.location}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {member.experience}
                          </div>
                        </div>
                      </div>

                      <p className="text-gray-700 leading-relaxed mb-6">
                        {member.bio}
                      </p>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Award className="w-5 h-5 text-red-500" />
                            Expertise
                          </h4>
                          <ul className="space-y-2">
                            {member.expertise.map((skill, skillIndex) => (
                              <li key={skillIndex} className="text-gray-600 text-sm flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                                {skill}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-red-500" />
                            Key Projects
                          </h4>
                          <ul className="space-y-2">
                            {member.projects.map((project, projectIndex) => (
                              <li key={projectIndex} className="text-gray-600 text-sm flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                                {project}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-gray-600">
                          <GraduationCap className="w-5 h-5 text-red-500" />
                          <span className="text-sm">{member.education}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Company Values Section */}
      <div className="relative z-10 py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-red-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-6">
              Our Vision &
              <span className="block text-red-400">Core Values</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              We're committed to transforming the construction industry through innovative 
              technology solutions that provide real-time insights and enhance project efficiency.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {companyValues.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <motion.div
                    className="bg-gradient-to-br from-red-500 to-red-600 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                  >
                    <value.icon className="w-6 h-6 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-xl font-semibold mb-3">{value.title}</h3>
                    <p className="text-gray-300 leading-relaxed">{value.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Mission Statement */}
      <div className="relative z-10 py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-8">Our Mission</h2>
            <p className="text-xl text-gray-700 leading-relaxed mb-8">
              To bridge the gap between traditional construction practices and modern technology 
              by creating intuitive, real-time progress monitoring solutions that empower construction 
              teams with instant visibility into project status and enhanced decision-making capabilities.
            </p>
            <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-2xl p-8">
              <p className="text-red-800 font-medium italic">
                "Every construction project deserves the clarity of real-time progress visualization 
                and the power of data-driven insights."
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="relative z-10 py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Get In Touch</h2>
            <p className="text-gray-600 mb-8">
              Ready to transform your construction project monitoring? Let's discuss how 
              our real-time progress visualization can benefit your projects.
            </p>
            
            <motion.button
              onClick={onBack}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start Your Project
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              className="flex justify-center items-center gap-4 mb-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center">
                  <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                </div>
              </div>
              <div>
                <span className="text-xl font-bold text-white">ROWAD</span>
                <div className="text-sm text-red-400 font-semibold -mt-1 tracking-wider">PROGRESS MONITORING</div>
              </div>
            </motion.div>
            
            <p className="text-gray-400">
              © 2024 Rowad Progress Monitoring. Developed by Mustafa Alzahaby & Ahmed Youssry.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}