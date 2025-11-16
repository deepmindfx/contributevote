import { supabase } from '@/integrations/supabase/client';

export interface DiscoverFilters {
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  frequency?: string;
  status?: string;
  progress?: 'low' | 'medium' | 'high' | 'complete';
  search?: string;
}

export type SortOption = 'newest' | 'most_funded' | 'most_contributors' | 'ending_soon' | 'alphabetical';

export const DiscoverService = {
  /**
   * Get public groups with filters, sorting, and pagination
   */
  async getPublicGroups(
    filters: DiscoverFilters = {},
    sortBy: SortOption = 'newest',
    page: number = 1,
    limit: number = 12
  ) {
    try {
      let query = supabase
        .from('contribution_groups')
        .select('*, creator:profiles!creator_id(name, email), contributors(count)', { count: 'exact' })
        .eq('privacy', 'public')
        .eq('archived', false)
        .not('privacy', 'is', null);

      // Apply filters
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      if (filters.minAmount) {
        query = query.gte('target_amount', filters.minAmount);
      }

      if (filters.maxAmount) {
        query = query.lte('target_amount', filters.maxAmount);
      }

      if (filters.frequency && filters.frequency !== 'all') {
        query = query.eq('frequency', filters.frequency);
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Apply sorting
      switch (sortBy) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'most_funded':
          query = query.order('current_amount', { ascending: false });
          break;
        case 'ending_soon':
          query = query.order('end_date', { ascending: true, nullsFirst: false });
          break;
        case 'alphabetical':
          query = query.order('name', { ascending: true });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Filter by progress if specified
      let filteredData = data || [];
      if (filters.progress) {
        filteredData = filteredData.filter(group => {
          const progress = group.target_amount > 0 
            ? (group.current_amount / group.target_amount) * 100 
            : 0;
          
          switch (filters.progress) {
            case 'low':
              return progress < 25;
            case 'medium':
              return progress >= 25 && progress < 75;
            case 'high':
              return progress >= 75 && progress < 100;
            case 'complete':
              return progress >= 100;
            default:
              return true;
          }
        });
      }

      return {
        groups: filteredData,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: (count || 0) > page * limit
      };
    } catch (error) {
      console.error('Error fetching public groups:', error);
      throw error;
    }
  },

  /**
   * Get group statistics for the marketplace
   */
  async getMarketplaceStats() {
    try {
      const { data, error } = await supabase
        .from('contribution_groups')
        .select('current_amount, target_amount, status')
        .eq('privacy', 'public')
        .eq('archived', false);

      if (error) throw error;

      const totalGroups = data?.length || 0;
      const totalFunded = data?.reduce((sum, g) => sum + (g.current_amount || 0), 0) || 0;
      const activeGroups = data?.filter(g => g.status === 'active').length || 0;
      const completedGroups = data?.filter(g => 
        g.current_amount >= g.target_amount
      ).length || 0;

      return {
        totalGroups,
        totalFunded,
        activeGroups,
        completedGroups
      };
    } catch (error) {
      console.error('Error fetching marketplace stats:', error);
      return {
        totalGroups: 0,
        totalFunded: 0,
        activeGroups: 0,
        completedGroups: 0
      };
    }
  },

  /**
   * Get trending groups (most activity in last 7 days)
   */
  async getTrendingGroups(limit: number = 6) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('contribution_groups')
        .select('*')
        .eq('privacy', 'public')
        .eq('archived', false)
        .gte('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching trending groups:', error);
      return [];
    }
  },

  /**
   * Get featured groups (high progress, active)
   */
  async getFeaturedGroups(limit: number = 6) {
    try {
      const { data, error } = await supabase
        .from('contribution_groups')
        .select('*')
        .eq('privacy', 'public')
        .eq('archived', false)
        .eq('status', 'active')
        .order('current_amount', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching featured groups:', error);
      return [];
    }
  },

  /**
   * Get categories with group counts
   */
  async getCategoriesWithCounts() {
    try {
      const { data, error } = await supabase
        .from('contribution_groups')
        .select('category')
        .eq('privacy', 'public')
        .eq('archived', false);

      if (error) throw error;

      // Count groups per category
      const categoryCounts: Record<string, number> = {};
      data?.forEach(group => {
        categoryCounts[group.category] = (categoryCounts[group.category] || 0) + 1;
      });

      return categoryCounts;
    } catch (error) {
      console.error('Error fetching category counts:', error);
      return {};
    }
  }
};
