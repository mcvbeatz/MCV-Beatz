import { createClient } from "@supabase/supabase-js";
export const PRACTICE_MODES = new Set([
  "duel",
  "fused",
  "fused3",
  "team",
  "tutorial",
]);
export class AccountService {
  constructor() {
    this.client = null;
    this.user = null;
    this.listeners = new Set();
    this.recovery = false;
    this.ready = false;
  }
  async initialize(config) {
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      this.ready = true;
      return;
    }
    if (!/^https:\/\//.test(config.supabaseUrl))
      throw new Error("Account service requires HTTPS.");
    // Only session tokens go into sessionStorage. Passwords exist only in the form and auth request.
    this.client = createClient(
      config.supabaseUrl,
      config.supabasePublishableKey,
      {
        auth: {
          storage: sessionStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
    this.client.auth.onAuthStateChange((event, session) => {
      this.user = session?.user || null;
      this.recovery =
        event === "PASSWORD_RECOVERY" ||
        (this.recovery && event !== "SIGNED_OUT");
      this.listeners.forEach((f) => f());
    });
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    this.user = data.session?.user || null;
    this.ready = true;
  }
  require() {
    if (!this.client)
      throw new Error(
        "Accounts are not connected yet. You can play as a guest; guest stats are not saved.",
      );
    return this.client;
  }
  async signIn(email, password) {
    const { error } = await this.require().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }
  async signUp(email, username, password) {
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username))
      throw new Error(
        "Use 3–24 letters, numbers or underscores for your username.",
      );
    const { error } = await this.require().auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: new URL("./", location.href).href,
      },
    });
    if (error) throw error;
  }
  async reset(email) {
    const { error } = await this.require().auth.resetPasswordForEmail(email, {
      redirectTo: new URL("./", location.href).href,
    });
    if (error) throw error;
  }
  async newPassword(password) {
    const { error } = await this.require().auth.updateUser({ password });
    if (error) throw error;
    this.recovery = false;
  }
  async signOut() {
    const { error } = await this.require().auth.signOut();
    if (error) throw error;
  }
  startMatch(mode, practice = false) {
    return {
      id: crypto.randomUUID(),
      userId: this.user?.id || null,
      mode,
      practice: practice || PRACTICE_MODES.has(mode),
    };
  }
  async saveMatch(ticket, g) {
    if (
      !ticket ||
      ticket.saved ||
      ticket.practice ||
      !ticket.userId ||
      ticket.userId !== this.user?.id ||
      !g.finished
    )
      return false;
    const { error } = await this.require().rpc("record_match", {
      p_match_id: ticket.id,
      p_mode: ticket.mode,
      p_kills: g.player.kills || 0,
      p_deaths: g.player.deaths || 0,
      p_result: g.result,
      p_duration: Math.floor(g.time),
    });
    if (error) throw error;
    ticket.saved = true;
    return true;
  }
  async stats() {
    if (!this.user) throw new Error("Sign in to view your stats.");
    const { data, error } = await this.require()
      .from("leaderboard")
      .select("*")
      .eq("user_id", this.user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  async leaderboard(metric = "kills", page = 0) {
    const order = ["kd_ratio", "kills", "deaths", "wins", "losses"].includes(
      metric,
    )
      ? metric
      : "kills";
    const { data, error } = await this.require()
      .from("leaderboard")
      .select("user_id,username,kills,deaths,wins,losses,kd_ratio")
      .order(order, { ascending: false })
      .order("username")
      .range(page * 5, page * 5 + 4);
    if (error) throw error;
    return data || [];
  }
}
