export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      albaranes: {
        Row: {
          id: string
          numero: string | null
          cliente_id: string | null
          orden_id: string | null
          descripcion: string | null
          estado: string | null
          fecha: string | null
          fotos_urls: string[] | null
          observaciones: string | null
          firmado: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          numero?: string | null
          cliente_id?: string | null
          orden_id?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha?: string | null
          fotos_urls?: string[] | null
          observaciones?: string | null
          firmado?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          numero?: string | null
          cliente_id?: string | null
          orden_id?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha?: string | null
          fotos_urls?: string[] | null
          observaciones?: string | null
          firmado?: boolean | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'albaranes_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'albaranes_orden_id_fkey'
            columns: ['orden_id']
            isOneToOne: false
            referencedRelation: 'ordenes'
            referencedColumns: ['id']
          },
        ]
      }
      clientes: {
        Row: {
          id: string
          nombre: string
          nombre_comercial: string | null
          nombre_fiscal: string | null
          poblacion: string | null
          tipo_cliente: string
          cif: string | null
          direccion: string | null
          telefono: string | null
          movil: string | null
          email: string | null
          notas: string | null
          es_recurrente: boolean | null
          frecuencia_recurrencia: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          nombre: string
          nombre_comercial?: string | null
          nombre_fiscal?: string | null
          poblacion?: string | null
          tipo_cliente?: string
          cif?: string | null
          direccion?: string | null
          telefono?: string | null
          movil?: string | null
          email?: string | null
          notas?: string | null
          es_recurrente?: boolean | null
          frecuencia_recurrencia?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          nombre_comercial?: string | null
          nombre_fiscal?: string | null
          poblacion?: string | null
          tipo_cliente?: string
          cif?: string | null
          direccion?: string | null
          telefono?: string | null
          movil?: string | null
          email?: string | null
          notas?: string | null
          es_recurrente?: boolean | null
          frecuencia_recurrencia?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      equipos: {
        Row: {
          id: string
          codigo: string
          tipo: string
          marca: string | null
          modelo: string | null
          estado: string | null
          ubicacion: string | null
          fecha_salida: string | null
          notas: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          codigo: string
          tipo: string
          marca?: string | null
          modelo?: string | null
          estado?: string | null
          ubicacion?: string | null
          fecha_salida?: string | null
          notas?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          codigo?: string
          tipo?: string
          marca?: string | null
          modelo?: string | null
          estado?: string | null
          ubicacion?: string | null
          fecha_salida?: string | null
          notas?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      fotos_ordenes: {
        Row: {
          id: string
          orden_id: string | null
          tipo: string | null
          url: string
          subida_por: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          orden_id?: string | null
          tipo?: string | null
          url: string
          subida_por?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          orden_id?: string | null
          tipo?: string | null
          url?: string
          subida_por?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fotos_ordenes_orden_id_fkey'
            columns: ['orden_id']
            isOneToOne: false
            referencedRelation: 'ordenes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fotos_ordenes_subida_por_fkey'
            columns: ['subida_por']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
        ]
      }
      materiales: {
        Row: {
          id: string
          nombre: string
          referencia: string | null
          categoria: string | null
          unidad: string | null
          stock: number | null
          minimo: number | null
          ubicacion: string | null
          foto_url: string | null
          notas: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          nombre: string
          referencia?: string | null
          categoria?: string | null
          unidad?: string | null
          stock?: number | null
          minimo?: number | null
          ubicacion?: string | null
          foto_url?: string | null
          notas?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          referencia?: string | null
          categoria?: string | null
          unidad?: string | null
          stock?: number | null
          minimo?: number | null
          ubicacion?: string | null
          foto_url?: string | null
          notas?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      movimientos: {
        Row: {
          id: string
          tipo: string
          material_id: string | null
          equipo_id: string | null
          orden_id: string | null
          tecnico_id: string | null
          cantidad: number | null
          estado_equipo: string | null
          observaciones: string | null
          fecha: string | null
        }
        Insert: {
          id?: string
          tipo: string
          material_id?: string | null
          equipo_id?: string | null
          orden_id?: string | null
          tecnico_id?: string | null
          cantidad?: number | null
          estado_equipo?: string | null
          observaciones?: string | null
          fecha?: string | null
        }
        Update: {
          id?: string
          tipo?: string
          material_id?: string | null
          equipo_id?: string | null
          orden_id?: string | null
          tecnico_id?: string | null
          cantidad?: number | null
          estado_equipo?: string | null
          observaciones?: string | null
          fecha?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'movimientos_material_id_fkey'
            columns: ['material_id']
            isOneToOne: false
            referencedRelation: 'materiales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimientos_equipo_id_fkey'
            columns: ['equipo_id']
            isOneToOne: false
            referencedRelation: 'equipos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimientos_orden_id_fkey'
            columns: ['orden_id']
            isOneToOne: false
            referencedRelation: 'ordenes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimientos_tecnico_id_fkey'
            columns: ['tecnico_id']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
        ]
      }
      ordenes: {
        Row: {
          id: string
          codigo: string
          tipo: string
          cliente_id: string | null
          tecnico_id: string | null
          fecha_programada: string | null
          fecha_cierre: string | null
          estado: string | null
          prioridad: string | null
          descripcion: string | null
          materiales_previstos: string | null
          observaciones: string | null
          created_at: string | null
          tecnicos_ids: string[] | null
          duracion_horas: number | null
          hora_fija: boolean | null
          vehiculo_id: string | null
          tecnico_vehiculo_id: string | null
        }
        Insert: {
          id?: string
          codigo: string
          tipo: string
          cliente_id?: string | null
          tecnico_id?: string | null
          fecha_programada?: string | null
          fecha_cierre?: string | null
          estado?: string | null
          prioridad?: string | null
          descripcion?: string | null
          materiales_previstos?: string | null
          observaciones?: string | null
          created_at?: string | null
          tecnicos_ids?: string[] | null
          duracion_horas?: number | null
          hora_fija?: boolean | null
          vehiculo_id?: string | null
          tecnico_vehiculo_id?: string | null
        }
        Update: {
          id?: string
          codigo?: string
          tipo?: string
          cliente_id?: string | null
          tecnico_id?: string | null
          fecha_programada?: string | null
          fecha_cierre?: string | null
          estado?: string | null
          prioridad?: string | null
          descripcion?: string | null
          materiales_previstos?: string | null
          observaciones?: string | null
          created_at?: string | null
          tecnicos_ids?: string[] | null
          duracion_horas?: number | null
          hora_fija?: boolean | null
          vehiculo_id?: string | null
          tecnico_vehiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ordenes_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordenes_tecnico_id_fkey'
            columns: ['tecnico_id']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordenes_tecnico_vehiculo_id_fkey'
            columns: ['tecnico_vehiculo_id']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ordenes_vehiculo_id_fkey'
            columns: ['vehiculo_id']
            isOneToOne: false
            referencedRelation: 'vehiculos_flota'
            referencedColumns: ['id']
          },
        ]
      }
      perfiles: {
        Row: {
          id: string
          nombre: string
          rol: string
          telefono: string | null
          activo: boolean | null
          created_at: string | null
        }
        Insert: {
          id: string
          nombre: string
          rol?: string
          telefono?: string | null
          activo?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          rol?: string
          telefono?: string | null
          activo?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      presupuestos: {
        Row: {
          id: string
          numero: string | null
          cliente_id: string | null
          titulo: string
          descripcion: string | null
          estado: string | null
          validez_dias: number | null
          lineas: Json | null
          total: number | null
          observaciones: string | null
          created_at: string | null
          fecha_envio: string | null
          importe: number | null
        }
        Insert: {
          id?: string
          numero?: string | null
          cliente_id?: string | null
          titulo: string
          descripcion?: string | null
          estado?: string | null
          validez_dias?: number | null
          lineas?: Json | null
          total?: number | null
          observaciones?: string | null
          created_at?: string | null
          fecha_envio?: string | null
          importe?: number | null
        }
        Update: {
          id?: string
          numero?: string | null
          cliente_id?: string | null
          titulo?: string
          descripcion?: string | null
          estado?: string | null
          validez_dias?: number | null
          lineas?: Json | null
          total?: number | null
          observaciones?: string | null
          created_at?: string | null
          fecha_envio?: string | null
          importe?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'presupuestos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
        ]
      }
      servicios_clientes: {
        Row: {
          id: string
          cliente_id: string
          fecha_servicio: string
          origen: string
          numero_documento: string | null
          descripcion: string | null
          importe: number | null
          metadata: Json | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cliente_id: string
          fecha_servicio: string
          origen?: string
          numero_documento?: string | null
          descripcion?: string | null
          importe?: number | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cliente_id?: string
          fecha_servicio?: string
          origen?: string
          numero_documento?: string | null
          descripcion?: string | null
          importe?: number | null
          metadata?: Json | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'servicios_clientes_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'servicios_clientes_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
        ]
      }
      vehiculos_documentos: {
        Row: {
          id: string
          vehiculo_id: string
          tipo: string
          nombre_archivo: string
          mime_type: string | null
          url: string
          fecha_emision: string | null
          fecha_caducidad: string | null
          proveedor: string | null
          numero_documento: string | null
          metadata: Json | null
          analisis_ia: Json | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          vehiculo_id: string
          tipo?: string
          nombre_archivo: string
          mime_type?: string | null
          url: string
          fecha_emision?: string | null
          fecha_caducidad?: string | null
          proveedor?: string | null
          numero_documento?: string | null
          metadata?: Json | null
          analisis_ia?: Json | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          vehiculo_id?: string
          tipo?: string
          nombre_archivo?: string
          mime_type?: string | null
          url?: string
          fecha_emision?: string | null
          fecha_caducidad?: string | null
          proveedor?: string | null
          numero_documento?: string | null
          metadata?: Json | null
          analisis_ia?: Json | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vehiculos_documentos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vehiculos_documentos_vehiculo_id_fkey'
            columns: ['vehiculo_id']
            isOneToOne: false
            referencedRelation: 'vehiculos_flota'
            referencedColumns: ['id']
          },
        ]
      }
      vehiculos_flota: {
        Row: {
          id: string
          matricula: string
          alias: string | null
          marca: string | null
          modelo: string | null
          tipo: string | null
          combustible: string | null
          anio: number | null
          km_actual: number | null
          proxima_itv: string | null
          vencimiento_itc: string | null
          vencimiento_seguro: string | null
          vencimiento_impuesto: string | null
          compania_seguro: string | null
          numero_poliza: string | null
          notas: string | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          matricula: string
          alias?: string | null
          marca?: string | null
          modelo?: string | null
          tipo?: string | null
          combustible?: string | null
          anio?: number | null
          km_actual?: number | null
          proxima_itv?: string | null
          vencimiento_itc?: string | null
          vencimiento_seguro?: string | null
          vencimiento_impuesto?: string | null
          compania_seguro?: string | null
          numero_poliza?: string | null
          notas?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          matricula?: string
          alias?: string | null
          marca?: string | null
          modelo?: string | null
          tipo?: string | null
          combustible?: string | null
          anio?: number | null
          km_actual?: number | null
          proxima_itv?: string | null
          vencimiento_itc?: string | null
          vencimiento_seguro?: string | null
          vencimiento_impuesto?: string | null
          compania_seguro?: string | null
          numero_poliza?: string | null
          notas?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
