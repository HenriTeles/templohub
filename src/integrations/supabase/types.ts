export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adjuracoes: {
        Row: {
          id: string
          nome: string
          templo_id: string | null
        }
        Insert: {
          id?: string
          nome: string
          templo_id?: string | null
        }
        Update: {
          id?: string
          nome?: string
          templo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adjuracoes_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      anexos: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mediun_id: string | null
          mime_type: string | null
          nome: string
          size_bytes: number | null
          storage_path: string
          templo_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mediun_id?: string | null
          mime_type?: string | null
          nome: string
          size_bytes?: number | null
          storage_path: string
          templo_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mediun_id?: string | null
          mime_type?: string | null
          nome?: string
          size_bytes?: number | null
          storage_path?: string
          templo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexos_mediun_id_fkey"
            columns: ["mediun_id"]
            isOneToOne: false
            referencedRelation: "mediuns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: number
          logo_path: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          logo_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          logo_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      centurias: {
        Row: {
          created_at: string
          id: string
          nome: string
          templo_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          templo_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          templo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "centurias_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          config: Json
          templo_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          templo_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          templo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: true
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      falanges: {
        Row: {
          categoria: string | null
          created_at: string
          id: string
          nome: string
          templo_id: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          id?: string
          nome: string
          templo_id?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          id?: string
          nome?: string
          templo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "falanges_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      historico: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          id: string
          mediun_id: string | null
          templo_id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          mediun_id?: string | null
          templo_id: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          mediun_id?: string | null
          templo_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_mediun_id_fkey"
            columns: ["mediun_id"]
            isOneToOne: false
            referencedRelation: "mediuns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      legioes: {
        Row: {
          id: string
          nome: string
          templo_id: string | null
        }
        Insert: {
          id?: string
          nome: string
          templo_id?: string | null
        }
        Update: {
          id?: string
          nome?: string
          templo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legioes_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      medium_custom_fields: {
        Row: {
          chave: string
          created_at: string
          id: string
          label: string
          obrigatorio: boolean
          opcoes: Json | null
          ordem: number
          parent_field_id: string | null
          templo_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          label: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          parent_field_id?: string | null
          templo_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          label?: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          parent_field_id?: string | null
          templo_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medium_custom_fields_parent_field_id_fkey"
            columns: ["parent_field_id"]
            isOneToOne: false
            referencedRelation: "medium_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medium_custom_fields_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      medium_custom_values: {
        Row: {
          created_at: string
          field_id: string
          id: string
          mediun_id: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          mediun_id: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          mediun_id?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medium_custom_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "medium_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medium_custom_values_mediun_id_fkey"
            columns: ["mediun_id"]
            isOneToOne: false
            referencedRelation: "mediuns"
            referencedColumns: ["id"]
          },
        ]
      }
      mediun_mentores: {
        Row: {
          created_at: string
          id: string
          mediun_id: string
          mentor_id: string
          templo_id: string
          tipo: Database["public"]["Enums"]["mentor_tipo"]
        }
        Insert: {
          created_at?: string
          id?: string
          mediun_id: string
          mentor_id: string
          templo_id: string
          tipo: Database["public"]["Enums"]["mentor_tipo"]
        }
        Update: {
          created_at?: string
          id?: string
          mediun_id?: string
          mentor_id?: string
          templo_id?: string
          tipo?: Database["public"]["Enums"]["mentor_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "mediun_mentores_mediun_id_fkey"
            columns: ["mediun_id"]
            isOneToOne: false
            referencedRelation: "mediuns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mediun_mentores_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mediun_mentores_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      mediuns: {
        Row: {
          adjunto: string | null
          adjunto_devas: string | null
          adjunto_povo: string | null
          adjunto_transito: string | null
          adjuracao_id: string | null
          caboclo: string | null
          cavaleiro: string | null
          centuria_id: string | null
          cep: string | null
          cidade: string | null
          classe_elevacao: string | null
          classificacao_medium: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_centuria: string | null
          data_consagracao: string | null
          data_elevacao_espadas: string | null
          data_emplacamento: string | null
          data_ingresso: string | null
          data_iniciacao: string | null
          data_inicio_desenvolvimento: string | null
          data_nascimento: string | null
          data_recebimento_cavaleiro: string | null
          data_setimo: string | null
          data_ultima_classificacao: string | null
          doenca_descricao: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          estado_civil: string | null
          falange_id: string | null
          falange_mestrado: string | null
          falange_missionaria: string | null
          falange_missionaria_id: string | null
          filho_de_devas: string | null
          foto_path: string | null
          funcao: Database["public"]["Enums"]["mediun_funcao"] | null
          guia_missionaria: string | null
          id: string
          lanca: string | null
          legiao_id: string | null
          medicamento_controlado: boolean | null
          medicamentos: string | null
          medico_crm: string | null
          medico_cura: string | null
          medico_prescritor: string | null
          mentores: string | null
          ministro: string | null
          nacionalidade: string | null
          nome_completo: string
          nome_emissao: string | null
          nome_mae: string | null
          nome_pai: string | null
          numero_ficha: string | null
          polaridade: Database["public"]["Enums"]["mediun_polaridade"] | null
          posologia: string | null
          possui_doenca: boolean | null
          povo: string | null
          povo_id: string | null
          preto_velho: string | null
          profissao: string | null
          recepcionista: boolean
          reino_id: string | null
          rg: string | null
          sexo: Database["public"]["Enums"]["mediun_sexo"] | null
          situacao: Database["public"]["Enums"]["mediun_situacao"]
          telefone: string | null
          templo_id: string
          tipo_sanguineo: string | null
          trino_id: string | null
          turno: string | null
          turno_trabalho: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          adjunto?: string | null
          adjunto_devas?: string | null
          adjunto_povo?: string | null
          adjunto_transito?: string | null
          adjuracao_id?: string | null
          caboclo?: string | null
          cavaleiro?: string | null
          centuria_id?: string | null
          cep?: string | null
          cidade?: string | null
          classe_elevacao?: string | null
          classificacao_medium?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_centuria?: string | null
          data_consagracao?: string | null
          data_elevacao_espadas?: string | null
          data_emplacamento?: string | null
          data_ingresso?: string | null
          data_iniciacao?: string | null
          data_inicio_desenvolvimento?: string | null
          data_nascimento?: string | null
          data_recebimento_cavaleiro?: string | null
          data_setimo?: string | null
          data_ultima_classificacao?: string | null
          doenca_descricao?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          falange_id?: string | null
          falange_mestrado?: string | null
          falange_missionaria?: string | null
          falange_missionaria_id?: string | null
          filho_de_devas?: string | null
          foto_path?: string | null
          funcao?: Database["public"]["Enums"]["mediun_funcao"] | null
          guia_missionaria?: string | null
          id?: string
          lanca?: string | null
          legiao_id?: string | null
          medicamento_controlado?: boolean | null
          medicamentos?: string | null
          medico_crm?: string | null
          medico_cura?: string | null
          medico_prescritor?: string | null
          mentores?: string | null
          ministro?: string | null
          nacionalidade?: string | null
          nome_completo: string
          nome_emissao?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero_ficha?: string | null
          polaridade?: Database["public"]["Enums"]["mediun_polaridade"] | null
          posologia?: string | null
          possui_doenca?: boolean | null
          povo?: string | null
          povo_id?: string | null
          preto_velho?: string | null
          profissao?: string | null
          recepcionista?: boolean
          reino_id?: string | null
          rg?: string | null
          sexo?: Database["public"]["Enums"]["mediun_sexo"] | null
          situacao?: Database["public"]["Enums"]["mediun_situacao"]
          telefone?: string | null
          templo_id: string
          tipo_sanguineo?: string | null
          trino_id?: string | null
          turno?: string | null
          turno_trabalho?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          adjunto?: string | null
          adjunto_devas?: string | null
          adjunto_povo?: string | null
          adjunto_transito?: string | null
          adjuracao_id?: string | null
          caboclo?: string | null
          cavaleiro?: string | null
          centuria_id?: string | null
          cep?: string | null
          cidade?: string | null
          classe_elevacao?: string | null
          classificacao_medium?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_centuria?: string | null
          data_consagracao?: string | null
          data_elevacao_espadas?: string | null
          data_emplacamento?: string | null
          data_ingresso?: string | null
          data_iniciacao?: string | null
          data_inicio_desenvolvimento?: string | null
          data_nascimento?: string | null
          data_recebimento_cavaleiro?: string | null
          data_setimo?: string | null
          data_ultima_classificacao?: string | null
          doenca_descricao?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          falange_id?: string | null
          falange_mestrado?: string | null
          falange_missionaria?: string | null
          falange_missionaria_id?: string | null
          filho_de_devas?: string | null
          foto_path?: string | null
          funcao?: Database["public"]["Enums"]["mediun_funcao"] | null
          guia_missionaria?: string | null
          id?: string
          lanca?: string | null
          legiao_id?: string | null
          medicamento_controlado?: boolean | null
          medicamentos?: string | null
          medico_crm?: string | null
          medico_cura?: string | null
          medico_prescritor?: string | null
          mentores?: string | null
          ministro?: string | null
          nacionalidade?: string | null
          nome_completo?: string
          nome_emissao?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero_ficha?: string | null
          polaridade?: Database["public"]["Enums"]["mediun_polaridade"] | null
          posologia?: string | null
          possui_doenca?: boolean | null
          povo?: string | null
          povo_id?: string | null
          preto_velho?: string | null
          profissao?: string | null
          recepcionista?: boolean
          reino_id?: string | null
          rg?: string | null
          sexo?: Database["public"]["Enums"]["mediun_sexo"] | null
          situacao?: Database["public"]["Enums"]["mediun_situacao"]
          telefone?: string | null
          templo_id?: string
          tipo_sanguineo?: string | null
          trino_id?: string | null
          turno?: string | null
          turno_trabalho?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mediuns_adjuracao_id_fkey"
            columns: ["adjuracao_id"]
            isOneToOne: false
            referencedRelation: "adjuracoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mediuns_centuria_id_fkey"
            columns: ["centuria_id"]
            isOneToOne: false
            referencedRelation: "centurias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mediuns_falange_id_fkey"
            columns: ["falange_id"]
            isOneToOne: false
            referencedRelation: "falanges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mediuns_falange_missionaria_id_fkey"
            columns: ["falange_missionaria_id"]
            isOneToOne: false
            referencedRelation: "falanges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mediuns_legiao_id_fkey"
            columns: ["legiao_id"]
            isOneToOne: false
            referencedRelation: "legioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mediuns_povo_id_fkey"
            columns: ["povo_id"]
            isOneToOne: false
            referencedRelation: "povos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mediuns_reino_id_fkey"
            columns: ["reino_id"]
            isOneToOne: false
            referencedRelation: "reinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mediuns_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mediuns_trino_id_fkey"
            columns: ["trino_id"]
            isOneToOne: false
            referencedRelation: "trinos"
            referencedColumns: ["id"]
          },
        ]
      }
      mentores: {
        Row: {
          created_at: string
          id: string
          nome: string
          templo_id: string | null
          tipo: Database["public"]["Enums"]["mentor_tipo"]
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          templo_id?: string | null
          tipo: Database["public"]["Enums"]["mentor_tipo"]
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          templo_id?: string | null
          tipo?: Database["public"]["Enums"]["mentor_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "mentores_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      povos: {
        Row: {
          id: string
          nome: string
          templo_id: string | null
        }
        Insert: {
          id?: string
          nome: string
          templo_id?: string | null
        }
        Update: {
          id?: string
          nome?: string
          templo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "povos_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          templo_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          templo_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          templo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      reinos: {
        Row: {
          id: string
          nome: string
          templo_id: string | null
        }
        Insert: {
          id?: string
          nome: string
          templo_id?: string | null
        }
        Update: {
          id?: string
          nome?: string
          templo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reinos_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      templos: {
        Row: {
          cidade: string | null
          created_at: string
          created_by: string | null
          estado: string | null
          id: string
          logo_path: string | null
          nome: string
          status: Database["public"]["Enums"]["templo_status"]
          theme_accent: string | null
          theme_primary: string | null
          theme_sidebar: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string | null
          id?: string
          logo_path?: string | null
          nome: string
          status?: Database["public"]["Enums"]["templo_status"]
          theme_accent?: string | null
          theme_primary?: string | null
          theme_sidebar?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string | null
          id?: string
          logo_path?: string | null
          nome?: string
          status?: Database["public"]["Enums"]["templo_status"]
          theme_accent?: string | null
          theme_primary?: string | null
          theme_sidebar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trinos: {
        Row: {
          id: string
          nome: string
          templo_id: string | null
        }
        Insert: {
          id?: string
          nome: string
          templo_id?: string | null
        }
        Update: {
          id?: string
          nome?: string
          templo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trinos_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          templo_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          templo_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          templo_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_templo_id_fkey"
            columns: ["templo_id"]
            isOneToOne: false
            referencedRelation: "templos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_templo: { Args: { _templo_id: string }; Returns: undefined }
      can_write_templo: {
        Args: { _templo_id: string; _user_id: string }
        Returns: boolean
      }
      create_templo_request: {
        Args: { _cidade: string; _estado: string; _nome: string }
        Returns: string
      }
      delete_templo: { Args: { _templo_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      promote_super_admin_by_email: {
        Args: { _email: string }
        Returns: undefined
      }
      reject_templo: { Args: { _templo_id: string }; Returns: undefined }
      update_templo: {
        Args: {
          _cidade: string
          _estado: string
          _nome: string
          _status: Database["public"]["Enums"]["templo_status"]
          _templo_id: string
        }
        Returns: undefined
      }
      user_templo: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "secretario" | "consulta"
      mediun_funcao: "mestre" | "ninfa"
      mediun_polaridade: "apara" | "doutrinador"
      mediun_sexo: "masculino" | "feminino"
      mediun_situacao:
        | "ativo"
        | "em_desenvolvimento"
        | "licenciado"
        | "afastado"
        | "desligado"
      mentor_tipo:
        | "cavaleiro"
        | "ministro"
        | "preto_velho"
        | "caboclo"
        | "medico_cura"
        | "guia_missionaria"
        | "princesa"
        | "preta_velha"
        | "cabocla"
        | "medica_cura"
      templo_status: "pendente" | "ativo" | "suspenso"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "secretario", "consulta"],
      mediun_funcao: ["mestre", "ninfa"],
      mediun_polaridade: ["apara", "doutrinador"],
      mediun_sexo: ["masculino", "feminino"],
      mediun_situacao: [
        "ativo",
        "em_desenvolvimento",
        "licenciado",
        "afastado",
        "desligado",
      ],
      mentor_tipo: [
        "cavaleiro",
        "ministro",
        "preto_velho",
        "caboclo",
        "medico_cura",
        "guia_missionaria",
        "princesa",
        "preta_velha",
        "cabocla",
        "medica_cura",
      ],
      templo_status: ["pendente", "ativo", "suspenso"],
    },
  },
} as const
