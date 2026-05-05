import { useState, MouseEvent } from "react";
import { motion } from "motion/react";
import { Property } from "../types";
import { MapPin, Home, Building2, Share2, Check } from "lucide-react";

interface PropertyListProps {
  properties: Property[];
  onSelect: (property: Property) => void;
}

export function PropertyList({ properties, onSelect }: PropertyListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleShare = (e: MouseEvent, property: Property) => {
    e.stopPropagation();
    // In a real app, this would be the actual URL to the property detail
    const url = `${window.location.origin}/?property=${property.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(property.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-6">
      {properties.map((property) => (
        <motion.div
          key={property.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -5 }}
          className="bg-white border border-[rgba(26,26,26,0.1)] rounded-sm overflow-hidden flex flex-col group cursor-pointer"
          onClick={() => onSelect(property)}
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            <img
              src={property.imageUrl}
              alt={property.title}
              referrerPolicy="no-referrer"
              className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-semibold flex items-center gap-2">
              {property.type === 'house' ? <Home size={12} /> : <Building2 size={12} />}
              {property.type}
            </div>
            <button
              onClick={(e) => handleShare(e, property)}
              className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full hover:bg-white transition-all shadow-sm"
              title="Compartilhar link"
              id={`share-${property.id}`}
            >
              {copiedId === property.id ? (
                <Check size={14} className="text-green-600" />
              ) : (
                <Share2 size={14} className="text-[var(--color-ink)]" />
              )}
            </button>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-serif text-2xl leading-none">{property.title}</h3>
              <span className="font-sans font-semibold text-lg text-[var(--color-gold)]">
                ${property.price.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[rgba(26,26,26,0.6)] uppercase tracking-tight mb-4">
              <MapPin size={14} className="text-[var(--color-gold)]" />
              {property.address}
            </div>
            <p className="text-sm text-[rgba(26,26,26,0.7)] line-clamp-2 mb-6">
              {property.description}
            </p>
            <div className="mt-auto pt-4 border-t border-[rgba(26,26,26,0.05)]">
              <button 
                className="w-full text-center text-[11px] uppercase tracking-[0.2em] font-semibold py-2 hover:text-[var(--color-gold)] transition-colors"
                id={`view-details-${property.id}`}
              >
                Inquire Details
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
