// src/components/HeroShowcase.tsx
import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Globe, BrainCircuit, Play } from 'lucide-react'

type Panel = {
  key: string
  title: string
  caption: string
  images: string[]        // ← multiple URLs for graceful fallback
  badge: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

// Curated, representative photos (Unsplash first, then Pexels/etc. as fallback)
const PANELS: Panel[] = [
  {
    key: 'viewer',
    title: '3D BIM Viewer',
    caption: 'Sections, isolate, measurements — Revit / IFC',
    images: [
      // Construction + CAD/BIM vibe
      'https://images.unsplash.com/photo-1581090462907-7b92daac176b?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1581093458791-9d0f3b6f9b3c?auto=format&fit=crop&w=1600&q=80',
      // Blueprint / plan
      'https://images.pexels.com/photos/256381/pexels-photo-256381.jpeg?auto=compress&cs=tinysrgb&w=1600'
    ],
    badge: 'WebGL • High-performance',
    icon: Layers
  },
  {
    key: 'twin',
    title: 'Digital Twin',
    caption: 'Live telemetry, progress states, asset health',
    images: [
      // Smart city with network overlay
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=1600&q=80',
      // City + tech
      'https://images.pexels.com/photos/313782/pexels-photo-313782.jpeg?auto=compress&cs=tinysrgb&w=1600'
    ],
    badge: 'Sensors • KPIs',
    icon: Globe
  },
  {
    key: 'arvr',
    title: 'AR / VR',
    caption: 'Overlay on site or walk in immersive VR',
    images: [
      // Person with VR headset
      'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
      // VR/AR scene
      'https://images.pexels.com/photos/3945665/pexels-photo-3945665.jpeg?auto=compress&cs=tinysrgb&w=1600'
    ],
    badge: 'Mobile AR • Headset VR',
    icon: Globe
  },
  {
    key: 'ai',
    title: 'AI Insights',
    caption: 'Summaries, quantities, anomaly alerts',
    images: [
      // Circuit/AI visualization
      'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1555255707-c07966088b7b?auto=format&fit=crop&w=1600&q=80',
      // Data/ML feel
      'https://images.pexels.com/photos/3861958/pexels-photo-3861958.jpeg?auto=compress&cs=tinysrgb&w=1600'
    ],
    badge: 'Computer Vision • NLP',
    icon: BrainCircuit
  }
]

export default function HeroShowcase() {
  const [i, setI] = useState(0)                         // which slide
  const [imgIdx, setImgIdx] = useState<number[]>(() =>  // which URL within each slide
    PANELS.map(() => 0)
  )

  const active = PANELS[i]
  const activeImg = active.images[imgIdx[i]] ?? active.images[0]

  // Auto-rotate slides
  useEffect(() => {
    const id = setInterval(() => setI(p => (p + 1) % PANELS.length), 5000)
    return () => clearInterval(id)
  }, [])

  // If an image fails, try the next URL for that panel
  const onImageError = () => {
    setImgIdx(prev => {
      const next = [...prev]
      next[i] = (prev[i] + 1) % active.images.length
      return next
    })
  }

  return (
    <div className="relative group">
      {/* glow */}
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-red-500/20 to-red-600/10 blur-2xl pointer-events-none" />
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900 will-change-transform transition-transform duration-300 group-hover:-translate-y-0.5">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${active.key}-${imgIdx[i]}`} // restart animation on image change too
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative"
          >
            {/* MEDIA */}
            <div className="relative">
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                {/* a tasteful fallback gradient is always behind the image */}
                <div
                  className="absolute inset-0 bg-slate-900"
                  style={{
                    backgroundImage:
                      'radial-gradient(1200px 400px at 20% 20%, rgba(255,255,255,.06), transparent 40%), ' +
                      'radial-gradient(800px 300px at 80% 60%, rgba(255,255,255,.05), transparent 45%)'
                  }}
                />
                <img
                  src={activeImg}
                  alt={active.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={onImageError}
                  className="absolute inset-0 h-full w-full object-cover opacity-90"
                />
              </div>

              {/* top badges */}
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="rounded-full bg-black/60 text-white/90 text-xs px-3 py-1 border border-white/10">
                  {active.badge}
                </span>
              </div>

              {/* title / caption */}
              <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black/65 via-black/20 to-transparent">
                <div className="flex items-center gap-2 text-white">
                  <active.icon className="w-5 h-5 text-red-300" />
                  <h3 className="text-lg font-semibold">{active.title}</h3>
                </div>
                <p className="text-slate-200/85 text-sm mt-1">{active.caption}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                  <Play className="w-4 h-4" />
                  <span>See it in action</span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* progress bar */}
        <motion.div
          key={`progress-${i}`}
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-red-500 to-red-600"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 5, ease: 'linear' }}
        />
      </div>

      {/* dots */}
      <div className="mt-3 flex justify-center gap-2">
        {PANELS.map((p, idx) => (
          <button
            key={p.key}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-8 bg-red-500' : 'w-3 bg-white/20 hover:bg-white/40'}`}
            aria-label={`Go to ${p.title}`}
          />
        ))}
      </div>
    </div>
  )
}
