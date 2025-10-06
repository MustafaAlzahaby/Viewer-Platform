import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Upload, FileText, Calendar, BarChart3 } from 'lucide-react'
import { Project } from '../lib/supabase'
import * as XLSX from 'xlsx'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef
} from '@tanstack/react-table'
import { Button } from '../components/ui/button'

interface BaselinePageProps {
  project: Project
  onBack: () => void
}

export function BaselinePage({ project, onBack }: BaselinePageProps) {
  const [data, setData] = useState<any[]>([])
  const [columns, setColumns] = useState<ColumnDef<any>[]>([])

  // Load Excel
  useEffect(() => {
    const loadExcel = async () => {
      try {
        const url = project.excel_url || '/excel-sheet/data.xlsx'
        const res = await fetch(url)
        const arrayBuffer = await res.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(sheet)
        setData(json)

        if (json.length > 0) {
          const sample = json[0] as Record<string, any>
          const dynamicCols: ColumnDef<any>[] = Object.keys(sample).map((key) => ({
            accessorKey: key,
            header: key,
            cell: info => info.getValue(),
          }))
          setColumns(dynamicCols)
        }
      } catch (err) {
        console.error('❌ Error loading Excel:', err)
      }
    }

    loadExcel()
  }, [project])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-400">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={onBack}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-red-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{project.name} – Baseline</h1>
                  <p className="text-sm text-gray-600">Project activities and progress tracking</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Update
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 p-6 mb-8 shadow-lg"
        >
          <div className="grid md:grid-cols-3 gap-6">
            <InfoCard icon={<Calendar className="text-red-600" />} label="Created" value={new Date(project.created_at).toLocaleDateString()} />
            <InfoCard icon={<BarChart3 className="text-green-400" />} label="Status" value="Active" />
            <InfoCard icon={<FileText className="text-purple-400" />} label="Last Updated" value={new Date(project.updated_at).toLocaleDateString()} />
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border border-gray-300 rounded-lg shadow"
        >
          <div className="overflow-auto max-h-[500px]">
            <table className="min-w-full text-sm text-left text-gray-700">
              <thead className="text-xs text-white uppercase bg-slate-700 sticky top-0">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} className="px-4 py-3 whitespace-nowrap">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-200">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-100 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-2 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center p-4 text-sm">
            <Button
              variant="outline"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Prev
            </Button>
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

// Reusable InfoCard component
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-gray-100 p-3 rounded-lg">{icon}</div>
      <div>
        <p className="text-gray-600 text-sm">{label}</p>
        <p className="text-gray-900 font-semibold">{value}</p>
      </div>
    </div>
  )
}
