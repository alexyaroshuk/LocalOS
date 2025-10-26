/**
 * Archive Memory Tools for the new memory architecture
 * These tools allow the AI to interact with long-term archive memory and task management
 */

import {Tool} from '../types';
import {DatabaseService} from './DatabaseService';

export class ArchiveMemoryTools {
  /**
   * Tool: save_memory
   * Save important information to archive memory
   */
  static getSaveMemoryTool(): Tool {
    return {
      name: 'save_memory',
      description:
        'Save important information to long-term archive memory. Use this to remember facts, events, preferences, or conversation highlights that may be useful later.',
      parameters: [
        {
          name: 'content',
          type: 'string',
          description: 'The information to remember',
          required: true,
        },
        {
          name: 'category',
          type: 'string',
          description: 'Category of the memory',
          required: true,
          enum: ['fact', 'event', 'preference', 'conversation'],
        },
        {
          name: 'importance',
          type: 'number',
          description: 'Importance score from 1-10 (10 being most important)',
          required: true,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {content, category, importance} = args;

          const memory = await DatabaseService.saveMemory(
            content,
            category,
            importance
          );

          return {
            success: true,
            message: 'Memory saved to archive',
            memory_id: memory.id,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save memory',
          };
        }
      },
    };
  }

  /**
   * Tool: search_archive
   * Search archive memory for relevant information
   */
  static getSearchArchiveTool(): Tool {
    return {
      name: 'search_archive',
      description:
        'Search long-term archive memory for relevant information. Use this to recall past conversations, facts, or events.',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'What to search for',
          required: true,
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of results (default 5)',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {query, limit = 5} = args;

          const memories = await DatabaseService.searchArchive(query, limit);

          if (memories.length === 0) {
            return {
              success: true,
              message: 'No relevant memories found',
              memories: [],
            };
          }

          return {
            success: true,
            message: `Found ${memories.length} relevant memories`,
            memories: memories.map(m => ({
              content: m.content,
              category: m.category,
              importance: m.importance,
              created_at: new Date(m.created_at).toLocaleDateString(),
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Search failed',
          };
        }
      },
    };
  }

  /**
   * Tool: create_task
   * Create a new task (one-time or recurring)
   */
  static getCreateTaskTool(): Tool {
    return {
      name: 'create_task',
      description:
        'Create a new task for the user. Can be a one-time task or recurring (daily, weekly, monthly).',
      parameters: [
        {
          name: 'title',
          type: 'string',
          description: 'Title of the task',
          required: true,
        },
        {
          name: 'description',
          type: 'string',
          description: 'Detailed description of the task',
          required: false,
        },
        {
          name: 'due_date',
          type: 'string',
          description: 'Due date in ISO format (e.g., "2025-01-15")',
          required: false,
        },
        {
          name: 'recurrence',
          type: 'string',
          description: 'Recurrence rule: "daily", "weekly", or "monthly"',
          required: false,
          enum: ['daily', 'weekly', 'monthly'],
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {title, description = '', due_date, recurrence} = args;

          // Parse due date if provided
          let dueDateMs: number | null = null;
          if (due_date) {
            dueDateMs = new Date(due_date).getTime();
          }

          const task = await DatabaseService.createTask(
            title,
            description,
            dueDateMs,
            recurrence || null
          );

          return {
            success: true,
            message: `Task created: ${title}`,
            task: {
              id: task.id,
              title: task.title,
              due_date: task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date',
              recurrence: task.recurrence_rule || 'One-time',
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create task',
          };
        }
      },
    };
  }

  /**
   * Tool: update_task
   * Update or complete a task
   */
  static getUpdateTaskTool(): Tool {
    return {
      name: 'update_task',
      description:
        'Update a task status, mark it as completed, or modify its details.',
      parameters: [
        {
          name: 'task_id',
          type: 'number',
          description: 'ID of the task to update',
          required: true,
        },
        {
          name: 'status',
          type: 'string',
          description: 'New status',
          required: false,
          enum: ['pending', 'completed', 'cancelled'],
        },
        {
          name: 'title',
          type: 'string',
          description: 'New title',
          required: false,
        },
        {
          name: 'description',
          type: 'string',
          description: 'New description',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {task_id, status, title, description} = args;

          const updates: any = {};
          if (status) updates.status = status;
          if (title) updates.title = title;
          if (description) updates.description = description;

          if (status === 'completed') {
            updates.completed_at = Date.now();
          }

          const task = await DatabaseService.updateTask(task_id, updates);

          if (!task) {
            return {
              success: false,
              error: `Task with ID ${task_id} not found`,
            };
          }

          return {
            success: true,
            message: `Task updated: ${task.title}`,
            task: {
              id: task.id,
              title: task.title,
              status: task.status,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update task',
          };
        }
      },
    };
  }

  /**
   * Tool: get_tasks
   * Retrieve tasks (today, overdue, upcoming, or all)
   */
  static getGetTasksTool(): Tool {
    return {
      name: 'get_tasks',
      description:
        'Get tasks based on criteria: today, overdue, upcoming, or all pending tasks.',
      parameters: [
        {
          name: 'filter',
          type: 'string',
          description: 'Filter criteria',
          required: false,
          enum: ['today', 'overdue', 'upcoming', 'all', 'completed'],
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {filter = 'all'} = args;

          let tasks;
          switch (filter) {
            case 'today':
              tasks = await DatabaseService.getTasksDueToday();
              break;
            case 'overdue':
              tasks = await DatabaseService.getOverdueTasks();
              break;
            case 'upcoming':
              tasks = await DatabaseService.getUpcomingTasks(7);
              break;
            case 'completed':
              tasks = await DatabaseService.getTasks('completed');
              break;
            default:
              tasks = await DatabaseService.getTasks('pending');
          }

          if (tasks.length === 0) {
            return {
              success: true,
              message: `No ${filter} tasks found`,
              tasks: [],
            };
          }

          return {
            success: true,
            message: `Found ${tasks.length} ${filter} tasks`,
            tasks: tasks.map(t => ({
              id: t.id,
              title: t.title,
              description: t.description,
              due_date: t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date',
              recurrence: t.recurrence_rule || 'One-time',
              status: t.status,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get tasks',
          };
        }
      },
    };
  }

  /**
   * Get all archive memory tools
   */
  static getAllTools(): Tool[] {
    return [
      this.getSaveMemoryTool(),
      this.getSearchArchiveTool(),
      this.getCreateTaskTool(),
      this.getUpdateTaskTool(),
      this.getGetTasksTool(),
    ];
  }
}
