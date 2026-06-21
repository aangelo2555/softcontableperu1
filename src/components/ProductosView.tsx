import React, { useState } from 'react';
import { Package, Plus, Trash2, Search, Edit2 } from 'lucide-react';
import { useStore, type Product } from '../store';
import PageHeader from './ui/PageHeader';
import ActionBar from './ui/ActionBar';
import FormField from './ui/FormField';
import { DataTable } from './DataTable';
import Toast from './shared/Toast';
import type { ToastData } from './shared/Toast';
import DecimalInput from './shared/DecimalInput';

const ProductosView: React.FC = () => {
  const { products, saveProduct, deleteProduct } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<ToastData | null>(null);

  const [form, setForm] = useState<Omit<Product, 'id'>>({
    code: '',
    name: '',
    unit_measure: 'NIU',
    type_existence: '01',
    account_id: '20111',
    stock_min: 0,
    sale_price: 0,
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = () => {
    if (!form.code || !form.name) {
      setToast({ type: 'error', message: 'Código y nombre son obligatorios.' });
      return;
    }

    const newProduct: Product = {
      ...form,
      id: editingId || `prod-${Date.now()}`
    };

    saveProduct(newProduct);
    setToast({ type: 'success', message: `Producto ${editingId ? 'actualizado' : 'guardado'} ✓` });
    handleClear();
  };

  const handleClear = () => {
    setForm({
      code: '',
      name: '',
      unit_measure: 'NIU',
      type_existence: '01',
      account_id: '20111',
      stock_min: 0,
      sale_price: 0,
    });
    setEditingId(null);
  };

  const handleEdit = (p: Product) => {
    setForm({
      code: p.code,
      name: p.name,
      unit_measure: p.unit_measure,
      type_existence: p.type_existence || '01',
      account_id: p.account_id,
      stock_min: p.stock_min,
      sale_price: p.sale_price || 0,
    });
    setEditingId(p.id);
  };

  const columns = [
    { header: 'CÓDIGO', accessor: (row: Product) => <span className="font-mono font-bold text-pld-blue">{row.code}</span> },
    { header: 'DESCRIPCIÓN', accessor: 'name' as keyof Product },
    { header: 'U.M.', accessor: 'unit_measure' as keyof Product, className: 'text-center' },
    { header: 'CTA. CONTABLE', accessor: (row: Product) => <span className="font-mono text-app-muted">{row.account_id}</span> },
    { header: 'STOCK MIN.', accessor: (row: Product) => <span className="font-mono text-right block">{row.stock_min}</span> },
    { header: 'ACCIONES', accessor: (row: Product) => (
      <div className="flex gap-2">
        <button onClick={() => handleEdit(row)} className="text-app-muted hover:text-pld-blue transition-colors p-1">
          <Edit2 size={14} />
        </button>
        <button onClick={() => {
          if (window.confirm('¿Eliminar producto?')) deleteProduct(row.id);
        }} className="text-app-muted hover:text-red-500 transition-colors p-1">
          <Trash2 size={14} />
        </button>
      </div>
    ), className: 'w-24' }
  ];

  return (
    <div className="h-full flex flex-col bg-app-bg overflow-hidden relative">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <PageHeader 
        icon={<Package size={18} />} 
        title="Catálogo de Productos" 
        subtitle="Gestión de inventarios y activos"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          
          <div className="section-card">
            <div className="section-card-header">
              <Plus size={15} />
              <span>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</span>
            </div>
            <div className="grid grid-cols-12 gap-4">
              <FormField label="Código" required className="col-span-6 sm:col-span-3">
                <input className="w-full text-sm font-mono uppercase" placeholder="P001" value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
              </FormField>
              <FormField label="Nombre / Descripción" required className="col-span-12 sm:col-span-4">
                <input className="w-full text-sm uppercase" placeholder="MERCADERIA TIPO A..." value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </FormField>
              <FormField label="T. Existencia (T5)" className="col-span-6 sm:col-span-2">
                <select className="w-full text-sm" value={form.type_existence} onChange={e => setForm({...form, type_existence: e.target.value})}>
                  <option value="01">01 - MERCADERÍA</option>
                  <option value="02">02 - PRODUCTO TERM.</option>
                  <option value="03">03 - MATERIA PRIMA</option>
                  <option value="04">04 - ENVASES</option>
                  <option value="05">05 - SUMINISTROS</option>
                </select>
              </FormField>
              <FormField label="U. Medida" className="col-span-6 sm:col-span-3">
                <select className="w-full text-sm" value={form.unit_measure} onChange={e => setForm({...form, unit_measure: e.target.value})}>
                  <option value="NIU">NIU - UNIDADES</option>
                  <option value="KG">KG - KILOGRAMOS</option>
                  <option value="MT">MT - METROS</option>
                  <option value="GLI">GLI - GALONES</option>
                </select>
              </FormField>
              <FormField label="Precio Venta Sugerido" className="col-span-6 sm:col-span-3">
                <DecimalInput className="w-full text-sm font-bold text-pld-blue" value={form.sale_price} onChange={v => setForm({...form, sale_price: v})} />
              </FormField>
              <FormField label="Cuenta Contable" className="col-span-6 sm:col-span-3">
                <input className="w-full text-sm font-mono" placeholder="20111" value={form.account_id} onChange={e => setForm({...form, account_id: e.target.value})} />
              </FormField>
              <FormField label="Stock Mínimo" className="col-span-6 sm:col-span-3">
                <input type="number" className="w-full text-sm text-right" value={form.stock_min} onChange={e => setForm({...form, stock_min: Number(e.target.value)})} />
              </FormField>
            </div>
          </div>

          <div className="section-card !p-0">
            <div className="p-4 border-b border-app-border flex justify-between items-center bg-app-surface/30">
              <h3 className="text-xs font-black uppercase tracking-widest">Listado de Productos</h3>
              <div className="relative w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
                <input 
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-app-bg border border-app-border rounded-lg focus:border-pld-blue outline-none transition-all"
                  placeholder="Buscar por nombre o código..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <DataTable columns={columns} data={filteredProducts} emptyMessage="No hay productos registrados." />
          </div>

        </div>
      </div>

      <ActionBar onSave={handleSave} onClear={handleClear} saveLabel={editingId ? 'Actualizar Producto' : 'Guardar Producto'} />
    </div>
  );
};

export default ProductosView;
