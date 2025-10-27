/**
 * Database Proxy - Routes to SQLite or Mock based on initialization
 */

import {DatabaseService} from './DatabaseService';
import {MockDatabaseService} from './MockDatabaseService';
import type {
  CoreMemoryBlock,
  ArchiveMemory,
  Task,
  ConversationSummary,
  UserFact,
} from './MockDatabaseService';

/**
 * Proxy that routes database calls to either SQLite or Mock implementation
 */
export class DatabaseProxy {
  private static usingSQLite: boolean = false;

  static setUsingSQLite(value: boolean) {
    this.usingSQLite = value;
  }

  static isUsingSQLite(): boolean {
    return this.usingSQLite;
  }

  // ============== CORE MEMORY OPERATIONS ==============

  static async getCoreMemory(): Promise<CoreMemoryBlock[]> {
    return this.usingSQLite
      ? DatabaseService.getCoreMemory()
      : MockDatabaseService.getCoreMemory();
  }

  static async getCoreMemoryBlock(blockName: string): Promise<CoreMemoryBlock | null> {
    return this.usingSQLite
      ? DatabaseService.getCoreMemoryBlock(blockName)
      : MockDatabaseService.getCoreMemoryBlock(blockName);
  }

  static async updateCoreMemoryBlock(blockName: string, content: string): Promise<void> {
    return this.usingSQLite
      ? DatabaseService.updateCoreMemoryBlock(blockName, content)
      : MockDatabaseService.updateCoreMemoryBlock(blockName, content);
  }

  // ============== ARCHIVE MEMORY OPERATIONS ==============

  static async saveMemory(
    content: string,
    category: ArchiveMemory['category'],
    importance: number,
    metadata?: Record<string, any>
  ): Promise<ArchiveMemory> {
    return this.usingSQLite
      ? DatabaseService.saveMemory(content, category, importance, metadata)
      : MockDatabaseService.saveMemory(content, category, importance, metadata);
  }

  static async searchArchive(query: string, limit: number = 5): Promise<ArchiveMemory[]> {
    return this.usingSQLite
      ? DatabaseService.searchArchive(query, limit)
      : MockDatabaseService.searchArchive(query, limit);
  }

  static async getRecentMemories(limit: number = 10): Promise<ArchiveMemory[]> {
    return this.usingSQLite
      ? DatabaseService.getRecentMemories(limit)
      : MockDatabaseService.getRecentMemories(limit);
  }

  static async getMemoriesByCategory(category: ArchiveMemory['category']): Promise<ArchiveMemory[]> {
    return this.usingSQLite
      ? DatabaseService.getMemoriesByCategory(category)
      : MockDatabaseService.getMemoriesByCategory(category);
  }

  static async updateArchiveMemory(id: number, updates: Partial<ArchiveMemory>): Promise<ArchiveMemory | null> {
    return this.usingSQLite
      ? DatabaseService.updateArchiveMemory(id, updates)
      : MockDatabaseService.updateArchiveMemory(id, updates);
  }

  static async deleteArchiveMemory(id: number): Promise<boolean> {
    return this.usingSQLite
      ? DatabaseService.deleteArchiveMemory(id)
      : MockDatabaseService.deleteArchiveMemory(id);
  }

  // ============== TASK OPERATIONS ==============

  static async createTask(
    title: string,
    description: string,
    dueDate: number | null,
    recurrenceRule: string | null
  ): Promise<Task> {
    return this.usingSQLite
      ? DatabaseService.createTask(title, description, dueDate, recurrenceRule)
      : MockDatabaseService.createTask(title, description, dueDate, recurrenceRule);
  }

  static async updateTask(id: number, updates: Partial<Task>): Promise<Task | null> {
    return this.usingSQLite
      ? DatabaseService.updateTask(id, updates)
      : MockDatabaseService.updateTask(id, updates);
  }

  static async completeTask(id: number): Promise<Task | null> {
    return this.usingSQLite
      ? DatabaseService.completeTask(id)
      : MockDatabaseService.completeTask(id);
  }

  static async getTasks(status?: Task['status']): Promise<Task[]> {
    return this.usingSQLite
      ? DatabaseService.getTasks(status)
      : MockDatabaseService.getTasks(status);
  }

  static async getTasksDueToday(): Promise<Task[]> {
    return this.usingSQLite
      ? DatabaseService.getTasksDueToday()
      : MockDatabaseService.getTasksDueToday();
  }

  static async getOverdueTasks(): Promise<Task[]> {
    return this.usingSQLite
      ? DatabaseService.getOverdueTasks()
      : MockDatabaseService.getOverdueTasks();
  }

  static async getUpcomingTasks(days: number = 7): Promise<Task[]> {
    return this.usingSQLite
      ? DatabaseService.getUpcomingTasks(days)
      : MockDatabaseService.getUpcomingTasks(days);
  }

  static async deleteTask(id: number): Promise<boolean> {
    return this.usingSQLite
      ? DatabaseService.deleteTask(id)
      : MockDatabaseService.deleteTask(id);
  }

  // ============== CONVERSATION OPERATIONS ==============

  static async saveConversation(
    summary: string,
    keyPoints: string[],
    messageCount: number
  ): Promise<ConversationSummary> {
    return this.usingSQLite
      ? DatabaseService.saveConversation(summary, keyPoints, messageCount)
      : MockDatabaseService.saveConversation(summary, keyPoints, messageCount);
  }

  static async getRecentConversations(limit: number = 10): Promise<ConversationSummary[]> {
    return this.usingSQLite
      ? DatabaseService.getRecentConversations(limit)
      : MockDatabaseService.getRecentConversations(limit);
  }

  // ============== USER FACTS OPERATIONS ==============

  static async saveUserFact(
    category: UserFact['category'],
    fact: string,
    confidence: number,
    sourceConversationId?: number
  ): Promise<UserFact> {
    return this.usingSQLite
      ? DatabaseService.saveUserFact(category, fact, confidence, sourceConversationId)
      : MockDatabaseService.saveUserFact(category, fact, confidence, sourceConversationId);
  }

  static async getUserFactsByCategory(category: UserFact['category']): Promise<UserFact[]> {
    return this.usingSQLite
      ? DatabaseService.getUserFactsByCategory(category)
      : MockDatabaseService.getUserFactsByCategory(category);
  }

  static async getAllUserFacts(): Promise<UserFact[]> {
    return this.usingSQLite
      ? DatabaseService.getAllUserFacts()
      : MockDatabaseService.getAllUserFacts();
  }

  static async updateUserFactConfidence(id: number, confidence: number): Promise<UserFact | null> {
    return this.usingSQLite
      ? DatabaseService.updateUserFactConfidence(id, confidence)
      : MockDatabaseService.updateUserFactConfidence(id, confidence);
  }

  static async updateUserFact(id: number, updates: Partial<UserFact>): Promise<UserFact | null> {
    return this.usingSQLite
      ? DatabaseService.updateUserFact(id, updates)
      : MockDatabaseService.updateUserFact(id, updates);
  }

  static async deleteUserFact(id: number): Promise<boolean> {
    return this.usingSQLite
      ? DatabaseService.deleteUserFact(id)
      : MockDatabaseService.deleteUserFact(id);
  }

  // ============== UTILITY ==============

  static async clear(): Promise<void> {
    return this.usingSQLite
      ? DatabaseService.clear()
      : MockDatabaseService.clear();
  }

  static async getStats() {
    return this.usingSQLite
      ? DatabaseService.getStats()
      : MockDatabaseService.getStats();
  }
}

// Re-export types
export type {
  CoreMemoryBlock,
  ArchiveMemory,
  Task,
  ConversationSummary,
  UserFact,
};
