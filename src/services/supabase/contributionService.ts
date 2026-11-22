import { supabase } from '@/integrations/supabase/client'
import { Database } from '@/integrations/supabase/types'

type ContributionGroup = Database['public']['Tables']['contribution_groups']['Row']
type ContributionGroupInsert = Database['public']['Tables']['contribution_groups']['Insert']
type ContributionGroupUpdate = Database['public']['Tables']['contribution_groups']['Update']
type Contributor = Database['public']['Tables']['contributors']['Row']
type ContributorInsert = Database['public']['Tables']['contributors']['Insert']

export class ContributionService {
  // Get all contribution groups
  static async getContributionGroups(): Promise<ContributionGroup[]> {
    const { data, error } = await supabase
      .from('contribution_groups')
      .select(`
        *,
        profiles!contribution_groups_creator_id_fkey(name, email),
        contributors(*)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  // Get contribution group by ID
  static async getContributionGroupById(id: string): Promise<ContributionGroup | null> {
    const { data, error } = await supabase
      .from('contribution_groups')
      .select(`
        *,
        profiles!contribution_groups_creator_id_fkey(name, email),
        contributors(*, profiles(name, email))
      `)
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data
  }

  // Get user's contribution groups
  static async getUserContributionGroups(userId: string, signal?: AbortSignal): Promise<ContributionGroup[]> {
    const created = supabase
      .from('contribution_groups')
      .select('*, contributors(user_id, has_voting_rights)')
      .eq('creator_id', userId)
    const joined = supabase
      .from('contribution_groups')
      .select('*, contributors(user_id, has_voting_rights), membership:contributors!inner()')
      .eq('membership.user_id', userId)
      .neq('creator_id', userId)
    const [owned, member] = await Promise.all([
      signal ? created.abortSignal(signal) : created,
      signal ? joined.abortSignal(signal) : joined,
    ])
    if (owned.error) throw owned.error
    if (member.error) throw member.error
    const unique = new Map((owned.data || []).map((group) => [group.id, group]))
    for (const group of member.data || []) unique.set(group.id, group)
    return [...unique.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  }

  // Create contribution group
  static async createContributionGroup(groupData: ContributionGroupInsert): Promise<ContributionGroup> {
    const { data, error } = await supabase
      .from('contribution_groups')
      .insert(groupData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Update contribution group
  static async updateContributionGroup(id: string, groupData: ContributionGroupUpdate): Promise<ContributionGroup> {
    const { data, error } = await supabase
      .from('contribution_groups')
      .update(groupData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Add contributor to group
  static async addContributor(contributorData: ContributorInsert): Promise<Contributor> {
    const { data, error } = await supabase
      .from('contributors')
      .insert(contributorData)
      .select()
      .single()
    
    if (error) throw error

    // Update group's current amount
    if (contributorData.group_id && contributorData.amount) {
      await this.incrementGroupAmount(contributorData.group_id, contributorData.amount)
    }

    return data
  }

  // Increment group's current amount
  static async incrementGroupAmount(groupId: string, amount: number): Promise<void> {
    // Manual update since we don't have RPC function yet
    const { data: group } = await supabase
      .from('contribution_groups')
      .select('current_amount')
      .eq('id', groupId)
      .single()
    
    if (group) {
      const { error } = await supabase
        .from('contribution_groups')
        .update({ current_amount: (group.current_amount || 0) + amount })
        .eq('id', groupId)
      
      if (error) throw error
    }
  }

  // Get contributors for a group
  static async getGroupContributors(groupId: string): Promise<Contributor[]> {
    const { data, error } = await supabase
      .from('contributors')
      .select(`
        *,
        profiles(name, email)
      `)
      .eq('group_id', groupId)
      .order('joined_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  // Delete contribution group
  static async deleteContributionGroup(id: string): Promise<void> {
    const { error } = await supabase
      .from('contribution_groups')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}
