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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_customer_breakdown: {
        Row: {
          active_count: number
          agent_id: string
          created_at: string
          date: string
          id: string
          inactive_count: number
          prospective_count: number
          updated_at: string
        }
        Insert: {
          active_count?: number
          agent_id: string
          created_at?: string
          date: string
          id?: string
          inactive_count?: number
          prospective_count?: number
          updated_at?: string
        }
        Update: {
          active_count?: number
          agent_id?: string
          created_at?: string
          date?: string
          id?: string
          inactive_count?: number
          prospective_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_customer_breakdown_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sales_summary: {
        Row: {
          agent_id: string
          created_at: string
          date: string
          id: string
          sales_count: number
          total_sales: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          date: string
          id?: string
          sales_count?: number
          total_sales?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          date?: string
          id?: string
          sales_count?: number
          total_sales?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_sales_summary_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_top_customers: {
        Row: {
          agent_id: string
          contact_id: string
          created_at: string
          id: string
          last_purchase_date: string | null
          rank: number
          total_sales: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          contact_id: string
          created_at?: string
          id?: string
          last_purchase_date?: string | null
          rank: number
          total_sales?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          last_purchase_date?: string | null
          rank?: number
          total_sales?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_top_customers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_top_customers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          agent_name: string
          channel: string
          contact_id: string
          direction: string
          duration_seconds: number | null
          id: string
          next_action: string | null
          next_action_due: string | null
          notes: string | null
          occurred_at: string | null
          outcome: string
        }
        Insert: {
          agent_name: string
          channel: string
          contact_id: string
          direction: string
          duration_seconds?: number | null
          id?: string
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          occurred_at?: string | null
          outcome: string
        }
        Update: {
          agent_name?: string
          channel?: string
          contact_id?: string
          direction?: string
          duration_seconds?: number | null
          id?: string
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          occurred_at?: string | null
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          aiReasoning: string | null
          aiScore: number | null
          area: string | null
          assignedAgent: string | null
          avatar: string | null
          balance: number | null
          businessLine: string | null
          city: string | null
          comment: string | null
          comments: Json | null
          company: string
          contactPersons: Json | null
          created_at: string | null
          creditLimit: number | null
          customerSince: string | null
          dealershipQuota: number | null
          dealershipSince: string | null
          dealershipTerms: string | null
          dealValue: number | null
          debtType: string | null
          deleted_at: string | null
          deliveryAddress: string | null
          email: string | null
          id: string
          interactions: Json | null
          is_deleted: boolean | null
          isHidden: boolean | null
          lastContactDate: string | null
          mobile: string | null
          name: string | null
          nextBestAction: string | null
          officeAddress: string | null
          pastName: string | null
          phone: string | null
          priceGroup: string | null
          province: string | null
          referBy: string | null
          salesByYear: Json | null
          salesHistory: Json | null
          salesman: string | null
          shippingAddress: string | null
          stage: string | null
          status: string | null
          team: string | null
          terms: string | null
          tin: string | null
          title: string | null
          topProducts: Json | null
          totalSales: number | null
          transactionType: string | null
          updated_at: string | null
          vatPercentage: string | null
          vatType: string | null
          winProbability: number | null
        }
        Insert: {
          address?: string | null
          aiReasoning?: string | null
          aiScore?: number | null
          area?: string | null
          assignedAgent?: string | null
          avatar?: string | null
          balance?: number | null
          businessLine?: string | null
          city?: string | null
          comment?: string | null
          comments?: Json | null
          company: string
          contactPersons?: Json | null
          created_at?: string | null
          creditLimit?: number | null
          customerSince?: string | null
          dealershipQuota?: number | null
          dealershipSince?: string | null
          dealershipTerms?: string | null
          dealValue?: number | null
          debtType?: string | null
          deleted_at?: string | null
          deliveryAddress?: string | null
          email?: string | null
          id?: string
          interactions?: Json | null
          is_deleted?: boolean | null
          isHidden?: boolean | null
          lastContactDate?: string | null
          mobile?: string | null
          name?: string | null
          nextBestAction?: string | null
          officeAddress?: string | null
          pastName?: string | null
          phone?: string | null
          priceGroup?: string | null
          province?: string | null
          referBy?: string | null
          salesByYear?: Json | null
          salesHistory?: Json | null
          salesman?: string | null
          shippingAddress?: string | null
          stage?: string | null
          status?: string | null
          team?: string | null
          terms?: string | null
          tin?: string | null
          title?: string | null
          topProducts?: Json | null
          totalSales?: number | null
          transactionType?: string | null
          updated_at?: string | null
          vatPercentage?: string | null
          vatType?: string | null
          winProbability?: number | null
        }
        Update: {
          address?: string | null
          aiReasoning?: string | null
          aiScore?: number | null
          area?: string | null
          assignedAgent?: string | null
          avatar?: string | null
          balance?: number | null
          businessLine?: string | null
          city?: string | null
          comment?: string | null
          comments?: Json | null
          company?: string
          contactPersons?: Json | null
          created_at?: string | null
          creditLimit?: number | null
          customerSince?: string | null
          dealershipQuota?: number | null
          dealershipSince?: string | null
          dealershipTerms?: string | null
          dealValue?: number | null
          debtType?: string | null
          deleted_at?: string | null
          deliveryAddress?: string | null
          email?: string | null
          id?: string
          interactions?: Json | null
          is_deleted?: boolean | null
          isHidden?: boolean | null
          lastContactDate?: string | null
          mobile?: string | null
          name?: string | null
          nextBestAction?: string | null
          officeAddress?: string | null
          pastName?: string | null
          phone?: string | null
          priceGroup?: string | null
          province?: string | null
          referBy?: string | null
          salesByYear?: Json | null
          salesHistory?: Json | null
          salesman?: string | null
          shippingAddress?: string | null
          stage?: string | null
          status?: string | null
          team?: string | null
          terms?: string | null
          tin?: string | null
          title?: string | null
          topProducts?: Json | null
          totalSales?: number | null
          transactionType?: string | null
          updated_at?: string | null
          vatPercentage?: string | null
          vatType?: string | null
          winProbability?: number | null
        }
        Relationships: []
      }
      customer_metrics: {
        Row: {
          average_monthly_purchase: number | null
          average_order_value: number | null
          contact_id: string
          created_at: string | null
          currency: string | null
          id: string
          last_purchase_date: string | null
          outstanding_balance: number | null
          purchase_frequency: number | null
          total_purchases: number | null
          updated_at: string | null
        }
        Insert: {
          average_monthly_purchase?: number | null
          average_order_value?: number | null
          contact_id: string
          created_at?: string | null
          currency?: string | null
          id?: string
          last_purchase_date?: string | null
          outstanding_balance?: number | null
          purchase_frequency?: number | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Update: {
          average_monthly_purchase?: number | null
          average_order_value?: number | null
          contact_id?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          last_purchase_date?: string | null
          outstanding_balance?: number | null
          purchase_frequency?: number | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_metrics_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          avatar: string | null
          company: string
          contactName: string | null
          created_at: string | null
          currency: string | null
          daysInStage: number | null
          id: string
          isOverdue: boolean | null
          isWarning: boolean | null
          ownerName: string | null
          stageId: string | null
          title: string
          updated_at: string | null
          value: number | null
          is_deleted: boolean
          deleted_at: string | null
          updatedAt: string | null
        }
        Insert: {
          avatar?: string | null
          company: string
          contactName?: string | null
          created_at?: string | null
          currency?: string | null
          daysInStage?: number | null
          id?: string
          isOverdue?: boolean | null
          isWarning?: boolean | null
          ownerName?: string | null
          stageId?: string | null
          title: string
          updated_at?: string | null
          value?: number | null
          is_deleted?: boolean
          deleted_at?: string | null
          updatedAt?: string | null
        }
        Update: {
          avatar?: string | null
          company?: string
          contactName?: string | null
          created_at?: string | null
          currency?: string | null
          daysInStage?: number | null
          id?: string
          isOverdue?: boolean | null
          isWarning?: boolean | null
          ownerName?: string | null
          stageId?: string | null
          title?: string
          updated_at?: string | null
          value?: number | null
          is_deleted?: boolean
          deleted_at?: string | null
          updatedAt?: string | null
        }
        Relationships: []
      }
      discount_requests: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          contact_id: string
          created_at: string | null
          discount_percentage: number
          id: string
          inquiry_id: string | null
          notes: string | null
          reason: string
          request_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approval_date?: string | null
          approved_by?: string | null
          contact_id: string
          created_at?: string | null
          discount_percentage: number
          id?: string
          inquiry_id?: string | null
          notes?: string | null
          reason: string
          request_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_date?: string | null
          approved_by?: string | null
          contact_id?: string
          created_at?: string | null
          discount_percentage?: number
          id?: string
          inquiry_id?: string | null
          notes?: string | null
          reason?: string
          request_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_requests_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          approval_date: string | null
          approval_status: string | null
          approved_by: string | null
          attachments: string[] | null
          contact_id: string
          created_at: string | null
          description: string
          id: string
          incident_date: string
          issue_type: string
          notes: string | null
          report_date: string
          reported_by: string
          updated_at: string | null
        }
        Insert: {
          approval_date?: string | null
          approval_status?: string | null
          approved_by?: string | null
          attachments?: string[] | null
          contact_id: string
          created_at?: string | null
          description: string
          id?: string
          incident_date: string
          issue_type: string
          notes?: string | null
          report_date: string
          reported_by: string
          updated_at?: string | null
        }
        Update: {
          approval_date?: string | null
          approval_status?: string | null
          approved_by?: string | null
          attachments?: string[] | null
          contact_id?: string
          created_at?: string | null
          description?: string
          id?: string
          incident_date?: string
          issue_type?: string
          notes?: string | null
          report_date?: string
          reported_by?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          channel: string
          contact_id: string
          id: string
          notes: string | null
          occurred_at: string | null
          sentiment: string | null
          title: string
        }
        Insert: {
          channel: string
          contact_id: string
          id?: string
          notes?: string | null
          occurred_at?: string | null
          sentiment?: string | null
          title: string
        }
        Update: {
          channel?: string
          contact_id?: string
          id?: string
          notes?: string | null
          occurred_at?: string | null
          sentiment?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_history: {
        Row: {
          contact_id: string
          converted_to_purchase: boolean | null
          created_at: string | null
          id: string
          inquiry_date: string
          notes: string | null
          product: string
          quantity: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id: string
          converted_to_purchase?: boolean | null
          created_at?: string | null
          id?: string
          inquiry_date: string
          notes?: string | null
          product: string
          quantity: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          converted_to_purchase?: boolean | null
          created_at?: string | null
          id?: string
          inquiry_date?: string
          notes?: string | null
          product?: string
          quantity?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          id: string
          invoice_id: string
          item_code: string | null
          part_no: string | null
          qty: number
          unit_price: number | null
          updated_at: string | null
          vat_rate: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id: string
          item_code?: string | null
          part_no?: string | null
          qty?: number
          unit_price?: number | null
          updated_at?: string | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string
          item_code?: string | null
          part_no?: string | null
          qty?: number
          unit_price?: number | null
          updated_at?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          contact_id: string
          created_at: string | null
          created_by: string
          credit_limit: number | null
          customer_reference: string | null
          deleted_at: string | null
          delivery_address: string | null
          due_date: string | null
          grand_total: number | null
          id: string
          inquiry_type: string | null
          invoice_no: string
          is_deleted: boolean | null
          order_id: string
          payment_date: string | null
          payment_method: string | null
          po_number: string | null
          price_group: string | null
          printed_at: string | null
          promise_to_pay: string | null
          reference_no: string | null
          remarks: string | null
          sales_date: string
          sales_person: string
          send_by: string | null
          sent_at: string | null
          status: string
          terms: string | null
          updated_at: string | null
          urgency: string | null
          urgency_date: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          created_by: string
          credit_limit?: number | null
          customer_reference?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          due_date?: string | null
          grand_total?: number | null
          id?: string
          inquiry_type?: string | null
          invoice_no: string
          is_deleted?: boolean | null
          order_id: string
          payment_date?: string | null
          payment_method?: string | null
          po_number?: string | null
          price_group?: string | null
          printed_at?: string | null
          promise_to_pay?: string | null
          reference_no?: string | null
          remarks?: string | null
          sales_date: string
          sales_person: string
          send_by?: string | null
          sent_at?: string | null
          status?: string
          terms?: string | null
          updated_at?: string | null
          urgency?: string | null
          urgency_date?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          created_by?: string
          credit_limit?: number | null
          customer_reference?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          due_date?: string | null
          grand_total?: number | null
          id?: string
          inquiry_type?: string | null
          invoice_no?: string
          is_deleted?: boolean | null
          order_id?: string
          payment_date?: string | null
          payment_method?: string | null
          po_number?: string | null
          price_group?: string | null
          printed_at?: string | null
          promise_to_pay?: string | null
          reference_no?: string | null
          remarks?: string | null
          sales_date?: string
          sales_person?: string
          send_by?: string | null
          sent_at?: string | null
          status?: string
          terms?: string | null
          updated_at?: string | null
          urgency?: string | null
          urgency_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_deleted: boolean | null
          is_read: boolean
          message: string
          metadata: Json | null
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_read?: boolean
          message: string
          metadata?: Json | null
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_read?: boolean
          message?: string
          metadata?: Json | null
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_slip_items: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          id: string
          item_code: string | null
          location: string | null
          order_slip_id: string
          part_no: string | null
          qty: number
          remark: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          item_code?: string | null
          location?: string | null
          order_slip_id: string
          part_no?: string | null
          qty?: number
          remark?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          item_code?: string | null
          location?: string | null
          order_slip_id?: string
          part_no?: string | null
          qty?: number
          remark?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_slip_items_order_slip_id_fkey"
            columns: ["order_slip_id"]
            isOneToOne: false
            referencedRelation: "order_slips"
            referencedColumns: ["id"]
          },
        ]
      }
      order_slips: {
        Row: {
          contact_id: string
          created_at: string | null
          created_by: string
          credit_limit: number | null
          customer_reference: string | null
          deleted_at: string | null
          delivery_address: string | null
          grand_total: number | null
          id: string
          inquiry_type: string | null
          is_deleted: boolean | null
          order_id: string
          po_number: string | null
          price_group: string | null
          printed_at: string | null
          printed_by: string | null
          promise_to_pay: string | null
          reference_no: string | null
          remarks: string | null
          sales_date: string
          sales_person: string
          send_by: string | null
          slip_no: string
          status: string
          terms: string | null
          updated_at: string | null
          urgency: string | null
          urgency_date: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          created_by: string
          credit_limit?: number | null
          customer_reference?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          grand_total?: number | null
          id?: string
          inquiry_type?: string | null
          is_deleted?: boolean | null
          order_id: string
          po_number?: string | null
          price_group?: string | null
          printed_at?: string | null
          printed_by?: string | null
          promise_to_pay?: string | null
          reference_no?: string | null
          remarks?: string | null
          sales_date: string
          sales_person: string
          send_by?: string | null
          slip_no: string
          status?: string
          terms?: string | null
          updated_at?: string | null
          urgency?: string | null
          urgency_date?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          created_by?: string
          credit_limit?: number | null
          customer_reference?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          grand_total?: number | null
          id?: string
          inquiry_type?: string | null
          is_deleted?: boolean | null
          order_id?: string
          po_number?: string | null
          price_group?: string | null
          printed_at?: string | null
          printed_by?: string | null
          promise_to_pay?: string | null
          reference_no?: string | null
          remarks?: string | null
          sales_date?: string
          sales_person?: string
          send_by?: string | null
          slip_no?: string
          status?: string
          terms?: string | null
          updated_at?: string | null
          urgency?: string | null
          urgency_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_slips_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_terms: {
        Row: {
          changed_by: string | null
          changed_date: string | null
          contact_id: string
          created_at: string | null
          credit_days: number | null
          end_date: string | null
          id: string
          installment_months: number | null
          previous_terms: string | null
          reason: string | null
          start_date: string
          status: string | null
          terms_type: string
          updated_at: string | null
        }
        Insert: {
          changed_by?: string | null
          changed_date?: string | null
          contact_id: string
          created_at?: string | null
          credit_days?: number | null
          end_date?: string | null
          id?: string
          installment_months?: number | null
          previous_terms?: string | null
          reason?: string | null
          start_date: string
          status?: string | null
          terms_type: string
          updated_at?: string | null
        }
        Update: {
          changed_by?: string | null
          changed_date?: string | null
          contact_id?: string
          created_at?: string | null
          credit_days?: number | null
          end_date?: string | null
          id?: string
          installment_months?: number | null
          previous_terms?: string | null
          reason?: string | null
          start_date?: string
          status?: string | null
          terms_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_terms_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_comments: {
        Row: {
          author_avatar: string | null
          author_id: string
          author_name: string
          contact_id: string
          created_at: string | null
          id: string
          text: string
          timestamp: string | null
          updated_at: string | null
        }
        Insert: {
          author_avatar?: string | null
          author_id: string
          author_name: string
          contact_id: string
          created_at?: string | null
          id?: string
          text: string
          timestamp?: string | null
          updated_at?: string | null
        }
        Update: {
          author_avatar?: string | null
          author_id?: string
          author_name?: string
          contact_id?: string
          created_at?: string | null
          id?: string
          text?: string
          timestamp?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_comments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          application: string | null
          barcode: string | null
          brand: string | null
          category: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          descriptive_inquiry: string | null
          id: string
          is_deleted: boolean | null
          item_code: string | null
          no_of_cylinder: string | null
          no_of_holes: string | null
          no_of_pieces_per_box: number | null
          oem_no: string | null
          original_pn_no: string | null
          part_no: string
          price_aa: number | null
          price_bb: number | null
          price_cc: number | null
          price_dd: number | null
          price_vip1: number | null
          price_vip2: number | null
          reorder_quantity: number | null
          replenish_quantity: number | null
          size: string | null
          status: string | null
          stock_wh1: number | null
          stock_wh2: number | null
          stock_wh3: number | null
          stock_wh4: number | null
          stock_wh5: number | null
          stock_wh6: number | null
          updated_at: string | null
        }
        Insert: {
          application?: string | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          descriptive_inquiry?: string | null
          id?: string
          is_deleted?: boolean | null
          item_code?: string | null
          no_of_cylinder?: string | null
          no_of_holes?: string | null
          no_of_pieces_per_box?: number | null
          oem_no?: string | null
          original_pn_no?: string | null
          part_no: string
          price_aa?: number | null
          price_bb?: number | null
          price_cc?: number | null
          price_dd?: number | null
          price_vip1?: number | null
          price_vip2?: number | null
          reorder_quantity?: number | null
          replenish_quantity?: number | null
          size?: string | null
          status?: string | null
          stock_wh1?: number | null
          stock_wh2?: number | null
          stock_wh3?: number | null
          stock_wh4?: number | null
          stock_wh5?: number | null
          stock_wh6?: number | null
          updated_at?: string | null
        }
        Update: {
          application?: string | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          descriptive_inquiry?: string | null
          id?: string
          is_deleted?: boolean | null
          item_code?: string | null
          no_of_cylinder?: string | null
          no_of_holes?: string | null
          no_of_pieces_per_box?: number | null
          oem_no?: string | null
          original_pn_no?: string | null
          part_no?: string
          price_aa?: number | null
          price_bb?: number | null
          price_cc?: number | null
          price_dd?: number | null
          price_vip1?: number | null
          price_vip2?: number | null
          reorder_quantity?: number | null
          replenish_quantity?: number | null
          size?: string | null
          status?: string | null
          stock_wh1?: number | null
          stock_wh2?: number | null
          stock_wh3?: number | null
          stock_wh4?: number | null
          stock_wh5?: number | null
          stock_wh6?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profile_creation_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: number
          metadata: Json | null
          success: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: never
          metadata?: Json | null
          success?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: never
          metadata?: Json | null
          success?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_rights: string[] | null
          avatar_url: string | null
          birthday: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          mobile: string | null
          monthly_quota: number | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          access_rights?: string[] | null
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          mobile?: string | null
          monthly_quota?: number | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          access_rights?: string[] | null
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          mobile?: string | null
          monthly_quota?: number | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchase_history: {
        Row: {
          contact_id: string
          created_at: string | null
          currency: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          payment_status: string
          products: Json
          purchase_date: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_status: string
          products?: Json
          purchase_date: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_status?: string
          products?: Json
          purchase_date?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount: number
          contact_id: string
          id: string
          notes: string | null
          purchased_at: string | null
          status: string
        }
        Insert: {
          amount?: number
          contact_id: string
          id?: string
          notes?: string | null
          purchased_at?: string | null
          status: string
        }
        Update: {
          amount?: number
          contact_id?: string
          id?: string
          notes?: string | null
          purchased_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      recycle_bin_items: {
        Row: {
          deleted_at: string
          deleted_by: string
          expires_at: string
          id: string
          is_restored: boolean | null
          item_id: string
          item_type: string
          original_data: Json
          permanent_delete_at: string | null
          restore_token: string
          restored_at: string | null
          restored_by: string | null
        }
        Insert: {
          deleted_at?: string
          deleted_by: string
          expires_at: string
          id?: string
          is_restored?: boolean | null
          item_id: string
          item_type: string
          original_data: Json
          permanent_delete_at?: string | null
          restore_token: string
          restored_at?: string | null
          restored_by?: string | null
        }
        Update: {
          deleted_at?: string
          deleted_by?: string
          expires_at?: string
          id?: string
          is_restored?: boolean | null
          item_id?: string
          item_type?: string
          original_data?: Json
          permanent_delete_at?: string | null
          restore_token?: string
          restored_at?: string | null
          restored_by?: string | null
        }
        Relationships: []
      }
      "reorder-report": {
        Row: {
          brand: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          part_no: string
          product_id: string | null
          reorder_point: number | null
          replenish_quantity: number | null
          status: string
          stock_snapshot: Json
          total_stock: number | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          part_no: string
          product_id?: string | null
          reorder_point?: number | null
          replenish_quantity?: number | null
          status: string
          stock_snapshot?: Json
          total_stock?: number | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          part_no?: string
          product_id?: string | null
          reorder_point?: number | null
          replenish_quantity?: number | null
          status?: string
          stock_snapshot?: Json
          total_stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reorder-report_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_inquiries: {
        Row: {
          contact_id: string
          created_at: string | null
          created_by: string
          credit_limit: number | null
          customer_reference: string | null
          deleted_at: string | null
          delivery_address: string | null
          grand_total: number | null
          id: string
          inquiry_no: string
          inquiry_type: string | null
          is_deleted: boolean | null
          po_number: string | null
          price_group: string | null
          promise_to_pay: string | null
          reference_no: string | null
          remarks: string | null
          sales_date: string
          sales_person: string
          send_by: string | null
          status: string
          terms: string | null
          updated_at: string | null
          urgency: string | null
          urgency_date: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          created_by: string
          credit_limit?: number | null
          customer_reference?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          grand_total?: number | null
          id?: string
          inquiry_no: string
          inquiry_type?: string | null
          is_deleted?: boolean | null
          po_number?: string | null
          price_group?: string | null
          promise_to_pay?: string | null
          reference_no?: string | null
          remarks?: string | null
          sales_date: string
          sales_person: string
          send_by?: string | null
          status?: string
          terms?: string | null
          updated_at?: string | null
          urgency?: string | null
          urgency_date?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          created_by?: string
          credit_limit?: number | null
          customer_reference?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          grand_total?: number | null
          id?: string
          inquiry_no?: string
          inquiry_type?: string | null
          is_deleted?: boolean | null
          po_number?: string | null
          price_group?: string | null
          promise_to_pay?: string | null
          reference_no?: string | null
          remarks?: string | null
          sales_date?: string
          sales_person?: string
          send_by?: string | null
          status?: string
          terms?: string | null
          updated_at?: string | null
          urgency?: string | null
          urgency_date?: string | null
        }
        Relationships: []
      }
      sales_inquiry_items: {
        Row: {
          amount: number | null
          approval_status: string | null
          created_at: string | null
          description: string | null
          id: string
          inquiry_id: string
          item_code: string | null
          location: string | null
          part_no: string | null
          qty: number
          remark: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          approval_status?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          inquiry_id: string
          item_code?: string | null
          location?: string | null
          part_no?: string | null
          qty?: number
          remark?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          approval_status?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          inquiry_id?: string
          item_code?: string | null
          location?: string | null
          part_no?: string | null
          qty?: number
          remark?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_inquiry_items_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "sales_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          amount: number | null
          approval_status: string | null
          created_at: string | null
          description: string | null
          id: string
          item_code: string | null
          location: string | null
          order_id: string
          part_no: string | null
          qty: number
          remark: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          approval_status?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          item_code?: string | null
          location?: string | null
          order_id: string
          part_no?: string | null
          qty?: number
          remark?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          approval_status?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          item_code?: string | null
          location?: string | null
          order_id?: string
          part_no?: string | null
          qty?: number
          remark?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contact_id: string
          created_at: string | null
          created_by: string
          credit_limit: number | null
          customer_reference: string | null
          deleted_at: string | null
          delivery_address: string | null
          grand_total: number | null
          id: string
          inquiry_id: string | null
          inquiry_type: string | null
          is_deleted: boolean | null
          order_no: string
          po_number: string | null
          price_group: string | null
          promise_to_pay: string | null
          reference_no: string | null
          remarks: string | null
          sales_date: string
          sales_person: string
          send_by: string | null
          status: string
          terms: string | null
          updated_at: string | null
          urgency: string | null
          urgency_date: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contact_id: string
          created_at?: string | null
          created_by: string
          credit_limit?: number | null
          customer_reference?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          grand_total?: number | null
          id?: string
          inquiry_id?: string | null
          inquiry_type?: string | null
          is_deleted?: boolean | null
          order_no: string
          po_number?: string | null
          price_group?: string | null
          promise_to_pay?: string | null
          reference_no?: string | null
          remarks?: string | null
          sales_date: string
          sales_person: string
          send_by?: string | null
          status?: string
          terms?: string | null
          updated_at?: string | null
          urgency?: string | null
          urgency_date?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contact_id?: string
          created_at?: string | null
          created_by?: string
          credit_limit?: number | null
          customer_reference?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          grand_total?: number | null
          id?: string
          inquiry_id?: string | null
          inquiry_type?: string | null
          is_deleted?: boolean | null
          order_no?: string
          po_number?: string | null
          price_group?: string | null
          promise_to_pay?: string | null
          reference_no?: string | null
          remarks?: string | null
          sales_date?: string
          sales_person?: string
          send_by?: string | null
          status?: string
          terms?: string | null
          updated_at?: string | null
          urgency?: string | null
          urgency_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "sales_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_progress: {
        Row: {
          contact_id: string
          created_at: string | null
          expected_closure_date: string | null
          id: string
          inquiry: string
          inquiry_date: string
          lost_reason: string | null
          notes: string | null
          outcome: string | null
          outcome_date: string | null
          stage: string
          stage_changed_date: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          expected_closure_date?: string | null
          id?: string
          inquiry: string
          inquiry_date: string
          lost_reason?: string | null
          notes?: string | null
          outcome?: string | null
          outcome_date?: string | null
          stage: string
          stage_changed_date?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          expected_closure_date?: string | null
          id?: string
          inquiry?: string
          inquiry_date?: string
          lost_reason?: string | null
          notes?: string | null
          outcome?: string | null
          outcome_date?: string | null
          stage?: string
          stage_changed_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_progress_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_reports: {
        Row: {
          approval_date: string | null
          approval_status: string | null
          approved_by: string | null
          contact_id: string
          created_at: string | null
          currency: string | null
          date: string
          id: string
          notes: string | null
          products: Json
          sales_agent: string
          time: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          approval_date?: string | null
          approval_status?: string | null
          approved_by?: string | null
          contact_id: string
          created_at?: string | null
          currency?: string | null
          date: string
          id?: string
          notes?: string | null
          products?: Json
          sales_agent: string
          time: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          approval_date?: string | null
          approval_status?: string | null
          approved_by?: string | null
          contact_id?: string
          created_at?: string | null
          currency?: string | null
          date?: string
          id?: string
          notes?: string | null
          products?: Json
          sales_agent?: string
          time?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_reports_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          contact_id: string
          created_at: string | null
          currency: string | null
          id: string
          incident_report_id: string
          notes: string | null
          processed_by: string | null
          processed_date: string | null
          products: Json
          reason: string
          return_date: string
          status: string | null
          total_refund: number
          updated_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          currency?: string | null
          id?: string
          incident_report_id: string
          notes?: string | null
          processed_by?: string | null
          processed_date?: string | null
          products?: Json
          reason: string
          return_date: string
          status?: string | null
          total_refund: number
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          incident_report_id?: string
          notes?: string | null
          processed_by?: string | null
          processed_date?: string | null
          products?: Json
          reason?: string
          return_date?: string
          status?: string | null
          total_refund?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_incident_report_id_fkey"
            columns: ["incident_report_id"]
            isOneToOne: false
            referencedRelation: "incident_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignedTo: string | null
          assigneeAvatar: string | null
          created_at: string | null
          createdBy: string | null
          deleted_at: string | null
          description: string | null
          dueDate: string | null
          id: string
          is_deleted: boolean | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignedTo?: string | null
          assigneeAvatar?: string | null
          created_at?: string | null
          createdBy?: string | null
          deleted_at?: string | null
          description?: string | null
          dueDate?: string | null
          id?: string
          is_deleted?: boolean | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignedTo?: string | null
          assigneeAvatar?: string | null
          created_at?: string | null
          createdBy?: string | null
          deleted_at?: string | null
          description?: string | null
          dueDate?: string | null
          id?: string
          is_deleted?: boolean | null
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      team_messages: {
        Row: {
          created_at: string
          id: string
          is_from_owner: boolean
          message: string
          sender_avatar: string | null
          sender_id: string
          sender_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_from_owner?: boolean
          message: string
          sender_avatar?: string | null
          sender_id: string
          sender_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_from_owner?: boolean
          message?: string
          sender_avatar?: string | null
          sender_id?: string
          sender_name?: string
        }
        Relationships: []
      }
      updated_contact_details: {
        Row: {
          approval_date: string | null
          approval_status: string | null
          approved_by: string | null
          changed_fields: Json
          contact_id: string
          created_at: string | null
          id: string
          notes: string | null
          submitted_by: string
          submitted_date: string | null
          updated_at: string | null
        }
        Insert: {
          approval_date?: string | null
          approval_status?: string | null
          approved_by?: string | null
          changed_fields: Json
          contact_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          submitted_by: string
          submitted_date?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_date?: string | null
          approval_status?: string | null
          approved_by?: string | null
          changed_fields?: Json
          contact_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          submitted_by?: string
          submitted_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "updated_contact_details_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          id: string
          contact_id: string | null
          phone_number: string | null
          channel: string
          purpose: string
          status: string
          started_at: string
          ended_at: string | null
          duration_seconds: number | null
          outcome: string | null
          sentiment: string | null
          summary: string | null
          assigned_agent_id: string | null
          metadata: Json | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          contact_id?: string | null
          phone_number?: string | null
          channel: string
          purpose: string
          status: string
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          outcome?: string | null
          sentiment?: string | null
          summary?: string | null
          assigned_agent_id?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          contact_id?: string | null
          phone_number?: string | null
          channel?: string
          purpose?: string
          status?: string
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          outcome?: string | null
          sentiment?: string | null
          summary?: string | null
          assigned_agent_id?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          content: string
          timestamp: string
          standard_answer_id: string | null
          confidence_score: number | null
        }
        Insert: {
          id?: string
          conversation_id: string
          role: string
          content: string
          timestamp?: string
          standard_answer_id?: string | null
          confidence_score?: number | null
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: string
          content?: string
          timestamp?: string
          standard_answer_id?: string | null
          confidence_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_messages_standard_answer_id_fkey"
            columns: ["standard_answer_id"]
            isOneToOne: false
            referencedRelation: "ai_standard_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_escalations: {
        Row: {
          id: string
          conversation_id: string
          reason: string
          priority: string
          assigned_to: string | null
          status: string
          created_at: string
          resolved_at: string | null
          resolution_notes: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          reason: string
          priority?: string
          assigned_to?: string | null
          status?: string
          created_at?: string
          resolved_at?: string | null
          resolution_notes?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          reason?: string
          priority?: string
          assigned_to?: string | null
          status?: string
          created_at?: string
          resolved_at?: string | null
          resolution_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_escalations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_escalations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_standard_answers: {
        Row: {
          id: string
          category: string
          trigger_keywords: string[]
          question_template: string
          answer_template: string
          variables: Json | null
          is_active: boolean
          priority: number
          created_by: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          category: string
          trigger_keywords: string[]
          question_template: string
          answer_template: string
          variables?: Json | null
          is_active: boolean
          priority: number
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          category?: string
          trigger_keywords?: string[]
          question_template?: string
          answer_template?: string
          variables?: Json | null
          is_active?: boolean
          priority?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_standard_answers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          id: string
          campaign_title: string
          description: string | null
          start_date: string | null
          end_date: string
          status: string
          created_by: string
          assigned_to: string[] | null
          target_platforms: string[]
          target_all_clients: boolean
          target_client_ids: string[] | null
          target_cities: string[] | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          is_deleted: boolean
        }
        Insert: {
          id?: string
          campaign_title: string
          description?: string | null
          start_date?: string | null
          end_date: string
          status: string
          created_by: string
          assigned_to?: string[] | null
          target_platforms: string[]
          target_all_clients?: boolean
          target_client_ids?: string[] | null
          target_cities?: string[] | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          is_deleted?: boolean
        }
        Update: {
          id?: string
          campaign_title?: string
          description?: string | null
          start_date?: string | null
          end_date?: string
          status?: string
          created_by?: string
          assigned_to?: string[] | null
          target_platforms?: string[]
          target_all_clients?: boolean
          target_client_ids?: string[] | null
          target_cities?: string[] | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          is_deleted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "promotions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_products: {
        Row: {
          id: string
          promotion_id: string
          product_id: string
          promo_price_aa: number | null
          promo_price_bb: number | null
          promo_price_cc: number | null
          promo_price_dd: number | null
          promo_price_vip1: number | null
          promo_price_vip2: number | null
          created_at: string
        }
        Insert: {
          id?: string
          promotion_id: string
          product_id: string
          promo_price_aa?: number | null
          promo_price_bb?: number | null
          promo_price_cc?: number | null
          promo_price_dd?: number | null
          promo_price_vip1?: number | null
          promo_price_vip2?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          promotion_id?: string
          product_id?: string
          promo_price_aa?: number | null
          promo_price_bb?: number | null
          promo_price_cc?: number | null
          promo_price_dd?: number | null
          promo_price_vip1?: number | null
          promo_price_vip2?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_products_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_postings: {
        Row: {
          id: string
          promotion_id: string
          platform_name: string
          posted_by: string | null
          post_url: string | null
          screenshot_url: string | null
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          promotion_id: string
          platform_name: string
          posted_by?: string | null
          post_url?: string | null
          screenshot_url?: string | null
          status: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          promotion_id?: string
          platform_name?: string
          posted_by?: string | null
          post_url?: string | null
          screenshot_url?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_postings_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_postings_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_postings_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_expiration_time: { Args: never; Returns: string }
      calculate_permanent_delete_time: { Args: never; Returns: string }
      generate_restore_token: { Args: never; Returns: string }
      get_unread_count: { Args: { user_id: string }; Returns: number }
      jsonb_to_text_array: { Args: { p_input: Json }; Returns: string[] }
      mark_notification_as_read: {
        Args: { notification_id: string }
        Returns: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const