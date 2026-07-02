// Hand-authored to match supabase/migrations (PRD.md §6). Regenerate with `npm run typegen`
// (`supabase gen types typescript`) once the schema is applied to your project.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MealSlot =
  | "pre_breakfast"
  | "breakfast"
  | "post_breakfast"
  | "mid_morning_snack"
  | "lunch"
  | "evening_snack"
  | "dinner"
  | "post_dinner";

export type MealStatus = "completed" | "skipped";

export type NotifPrefs = {
  water?: boolean;
  meals?: boolean;
  partner?: boolean;
  weekly?: boolean;
  quiet_hours?: { start: string; end: string };
  water_interval_min?: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          display_name: string;
          avatar_url: string | null;
          water_target_ml: number;
          bottle_size_ml: number;
          workout_days: number[];
          weight_meals: number;
          weight_water: number;
          weight_workout: number;
          notif_prefs: Json;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string;
          display_name: string;
          avatar_url?: string | null;
          water_target_ml?: number;
          bottle_size_ml?: number;
          workout_days?: number[];
          weight_meals?: number;
          weight_water?: number;
          weight_workout?: number;
          notif_prefs?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          display_name?: string;
          avatar_url?: string | null;
          water_target_ml?: number;
          bottle_size_ml?: number;
          workout_days?: number[];
          weight_meals?: number;
          weight_water?: number;
          weight_workout?: number;
          notif_prefs?: Json;
        };
        Relationships: [];
      };
      plan_items: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          user_id: string;
          day_of_week: number;
          meal_slot: string | null;
          title: string;
          target_time: string | null;
          note: string | null;
          target_calories: number | null;
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
          day_of_week: number;
          meal_slot?: string | null;
          title: string;
          target_time?: string | null;
          note?: string | null;
          target_calories?: number | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
          day_of_week?: number;
          meal_slot?: string | null;
          title?: string;
          target_time?: string | null;
          note?: string | null;
          target_calories?: number | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      meal_logs: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          user_id: string;
          plan_item_id: string | null;
          log_date: string;
          logged_at: string;
          status: MealStatus;
          calories: number | null;
          photo_path: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
          plan_item_id?: string | null;
          log_date: string;
          logged_at?: string;
          status?: MealStatus;
          calories?: number | null;
          photo_path?: string | null;
          note?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
          plan_item_id?: string | null;
          log_date?: string;
          logged_at?: string;
          status?: MealStatus;
          calories?: number | null;
          photo_path?: string | null;
          note?: string | null;
        };
        Relationships: [];
      };
      water_logs: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          log_date: string;
          logged_at: string;
          amount_ml: number;
          note: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          log_date: string;
          logged_at?: string;
          amount_ml: number;
          note?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          log_date?: string;
          logged_at?: string;
          amount_ml?: number;
          note?: string | null;
        };
        Relationships: [];
      };
      workout_logs: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          user_id: string;
          log_date: string;
          logged_at: string;
          type: string | null;
          duration_min: number | null;
          photo_path: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
          log_date: string;
          logged_at?: string;
          type?: string | null;
          duration_min?: number | null;
          photo_path?: string | null;
          note?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
          log_date?: string;
          logged_at?: string;
          type?: string | null;
          duration_min?: number | null;
          photo_path?: string | null;
          note?: string | null;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          device_label: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          device_label?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          device_label?: string | null;
        };
        Relationships: [];
      };
      weekly_results: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          week_start: string;
          user_a: string;
          points_a: number;
          user_b: string;
          points_b: number;
          winner_id: string | null;
          prize: string | null;
          prize_paid: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          week_start: string;
          user_a: string;
          points_a: number;
          user_b: string;
          points_b: number;
          winner_id?: string | null;
          prize?: string | null;
          prize_paid?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          week_start?: string;
          user_a?: string;
          points_a?: number;
          user_b?: string;
          points_b?: number;
          winner_id?: string | null;
          prize?: string | null;
          prize_paid?: boolean;
        };
        Relationships: [];
      };
      achievements: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          earned_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code: string;
          earned_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code?: string;
          earned_at?: string;
        };
        Relationships: [];
      };
      notification_sends: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          dedupe_key: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          dedupe_key: string;
          sent_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category?: string;
          dedupe_key?: string;
          sent_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      daily_scores: {
        Row: {
          user_id: string;
          log_date: string;
          meal_points: number;
          water_points: number;
          workout_points: number;
          total: number;
        };
        Relationships: [];
      };
      weekly_scores: {
        Row: {
          user_id: string;
          week_start: string;
          total: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      finalize_week: {
        Args: { p_week_start: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Convenience row aliases used across the app.
type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"];

export type Profile = Tables<"profiles">;
export type PlanItem = Tables<"plan_items">;
export type MealLog = Tables<"meal_logs">;
export type WaterLog = Tables<"water_logs">;
export type WorkoutLog = Tables<"workout_logs">;
export type PushSubscriptionRow = Tables<"push_subscriptions">;
export type WeeklyResult = Tables<"weekly_results">;
export type Achievement = Tables<"achievements">;
export type DailyScore = Views<"daily_scores">;
export type WeeklyScore = Views<"weekly_scores">;
