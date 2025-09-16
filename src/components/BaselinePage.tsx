import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Upload, FileText, Calendar, BarChart3 } from 'lucide-react'
import { Project } from '../lib/supabase'
import { ExcelDataPanel } from '../core/ExcelDataPanel'

interface BaselinePageProps {
  project: Project
  onBack: () => void
}

export function BaselinePage({ project, onBack }: BaselinePageProps) {
  const [excelPanel, setExcelPanel] = useState<ExcelDataPanel | null>(null)

  useEffect(() => {
    // Initialize Excel panel
    const panel = new ExcelDataPanel('baseline-container')
    setExcelPanel(panel)

    // Load project's Excel data
    if (project.excel_url) {
      panel.loadExcelData(
        project.excel_url,
        'Activity Name',
        'Performance % Complete',
        'Finish'
      )
    } else {
      // Load demo data
      panel.loadExcelData(
        '/excel-sheet/data.xlsx',
        'Activity Name',
        'Performance % Complete',
        'Finish'
      )
    }

    return () => {
      panel?.dispose()
    }
  }, [project])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-green-400" />
                <div>
                  <h1 className="text-xl font-bold text-white">{project.name} - Baseline</h1>
                  <p className="text-sm text-slate-300">Project activities and progress tracking</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
              <button className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors">
                <Upload className="w-4 h-4" />
                Update
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Project Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6 mb-8"
        >
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-300 text-sm">Created</p>
                <p className="text-white font-semibold">
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-green-500/20 p-3 rounded-lg">
                <BarChart3 className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-slate-300 text-sm">Status</p>
                <p className="text-white font-semibold">Active</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-purple-500/20 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-300 text-sm">Last Updated</p>
                <p className="text-white font-semibold">
                  {new Date(project.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Excel Data Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          id="baseline-container"
          className="relative"
        >
          {/* The ExcelDataPanel will be rendered here */}
        </motion.div>
      </main>
    </div>
  )
}