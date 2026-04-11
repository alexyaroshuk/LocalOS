/**
 * OrchestrationService - Multi-step AI Workflow Coordinator
 *
 * Handles complex, multi-step AI tasks by:
 * 1. Decomposing user queries into subtasks
 * 2. Executing tools and sub-queries in sequence/parallel
 * 3. Managing state across steps
 * 4. Synthesizing results into coherent responses
 *
 * Pluggable architecture allows adding new workflows (memory ops, analysis, etc)
 */

import {Message, LlamaConfig} from '../types';
import {AIService} from './AIService';
import {ToolService} from './ToolService';
import {Logger, LogSection} from '../utils/Logger';
import {generateId} from '../utils/helpers';

export interface OrchestrationStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  duration?: number;
  result?: any;
  error?: string;
}

export interface OrchestrationState {
  workflowId: string;
  workflowType: string;
  originalQuery: string;
  steps: OrchestrationStep[];
  finalResult?: string;
  metadata: Record<string, any>;
}

export interface OrchestrationResult {
  success: boolean;
  response: string;
  state: OrchestrationState;
  citations?: Array<{title: string; url: string}>;
  duration: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

export interface FetchedPage {
  url: string;
  title: string;
  summary: string;
  content_length: number;
}

export class OrchestrationService {
  private static state: Map<string, OrchestrationState> = new Map();

  /**
   * Main entry point - dispatches to appropriate workflow
   */
  static async executeWorkflow(
    workflowType: 'web_search' | 'memory_update' | 'deep_analysis',
    userQuery: string,
    config?: Partial<LlamaConfig>,
    onProgress?: (step: OrchestrationStep) => void,
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const workflowId = generateId();

    const state: OrchestrationState = {
      workflowId,
      workflowType,
      originalQuery: userQuery,
      steps: [],
      metadata: {},
    };

    LogSection.start(`🎼 ORCHESTRATION WORKFLOW: ${workflowType}`);
    Logger.info(`Workflow ID: ${workflowId}`);
    Logger.info(`Workflow Type: ${workflowType}`);
    Logger.info(`User Query: "${userQuery}"`);
    Logger.debug('Orchestration Config:', config);

    try {
      this.state.set(workflowId, state);

      let result: OrchestrationResult;

      if (workflowType === 'web_search') {
        result = await this.webSearchWorkflow(
          userQuery,
          state,
          config,
          onProgress,
        );
      } else {
        Logger.error(`Unknown workflow type: ${workflowType}`);
        throw new Error(`Unknown workflow type: ${workflowType}`);
      }

      result.duration = Date.now() - startTime;
      Logger.info(`✅ Orchestration completed in ${result.duration}ms`);
      Logger.info(`Success: ${result.success}`);
      Logger.debug('Final citations:', result.citations);
      LogSection.end();
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.error(`❌ Orchestration failed after ${duration}ms`);
      Logger.error('Error:', error instanceof Error ? error.message : String(error));
      Logger.debug('Workflow State:', state);
      LogSection.end();
      throw error;
    }
  }

  /**
   * Web Search Orchestration Workflow
   * Steps:
   * 1. Parse intent from query
   * 2. Execute web search
   * 3. Evaluate results for relevance
   * 4. Fetch top pages in parallel
   * 5. Synthesize comprehensive answer with citations
   */
  private static async webSearchWorkflow(
    userQuery: string,
    state: OrchestrationState,
    config?: Partial<LlamaConfig>,
    onProgress?: (step: OrchestrationStep) => void,
  ): Promise<OrchestrationResult> {
    const defaultConfig: Partial<LlamaConfig> = {
      temperature: 0.7,
      maxTokens: 300,
      ...config,
    };

    // Step 1: Parse Intent - Let LLM decide if web search is needed
    const parseStep = await this.executeStep(
      state,
      'parse_intent',
      'Analyzing query intent...',
      async () => {
        const parsePrompt = `You are an intelligent query router. Analyze the user's query and decide if it requires real-time web search.

User query: "${userQuery}"

Consider:
- Does this query ask for current/recent information? (news, trends, "latest", "today", "this week")
- Does this query ask for something you might not know about? (specific products, new technologies, current events)
- Does this query ask for finding something specific? (search for, find, look up, where can I find)
- Or is this something you can answer from your knowledge? (explain concepts, general knowledge, how-to guides)

Respond with ONLY "yes" or "no" on the first line.
Then briefly explain your reasoning.

Example:
yes
This asks for latest news which changes daily and requires real-time information.

OR

no
This is asking me to explain a concept, which I can do without web search.`;

        const messages: Message[] = [
          {
            id: generateId(),
            role: 'user',
            content: parsePrompt,
            timestamp: Date.now(),
          },
        ];

        const response = await AIService.chatCompletion(
          messages,
          {...defaultConfig, maxTokens: 150},
        );

        const shouldSearch = response.toLowerCase().startsWith('yes');

        return {
          analysis: response,
          shouldSearch,
        };
      },
      onProgress,
    );

    if (!parseStep.result?.shouldSearch) {
      // Query doesn't need web search, just respond normally
      Logger.info('🔍 Intent Analysis: Query does NOT require web search');
      Logger.info('📝 Using direct response instead of orchestration');

      const messages: Message[] = [
        {
          id: generateId(),
          role: 'user',
          content: userQuery,
          timestamp: Date.now(),
        },
      ];

      const response = await AIService.chatCompletion(messages, defaultConfig);
      Logger.debug('Direct response:', response.substring(0, 200));

      return {
        success: true,
        response,
        state,
        duration: 0,
      };
    }

    Logger.info('🌐 Intent Analysis: Query REQUIRES web search - proceeding with orchestration');
    Logger.debug('Parse Intent Result:', parseStep.result);

    // Step 2: Execute Web Search
    const searchStep = await this.executeStep(
      state,
      'web_search',
      'Searching the web...',
      async () => {
        const searchTool = ToolService.getTool('search_web');
        if (!searchTool) {
          Logger.error('search_web tool not found in ToolService');
          throw new Error('search_web tool not found');
        }

        Logger.info('📡 Calling search_web tool...');
        const searchResult: any = await searchTool.execute({
          query: userQuery,
        });

        if (!searchResult.success || !searchResult.results) {
          Logger.error('Web search returned no results');
          Logger.debug('Search result:', searchResult);
          throw new Error('Web search failed');
        }

        Logger.info(`✅ Web search returned ${searchResult.results.length} results`);
        Logger.debug('Search results:', searchResult.results.map((r: SearchResult) => ({
          title: r.title,
          url: r.url,
        })));

        return {
          results: searchResult.results,
          count: searchResult.results.length,
        };
      },
      onProgress,
    );

    const searchResults: SearchResult[] = searchStep.result.results;
    Logger.info(`🎯 Got ${searchResults.length} search results to evaluate`);

    // Step 3: Evaluate Results for Relevance
    const evaluateStep = await this.executeStep(
      state,
      'evaluate_results',
      'Evaluating search result relevance...',
      async () => {
        Logger.info('🧠 Evaluating relevance of search results...');
        Logger.debug('Results to evaluate:', searchResults.map((r, i) => `${i + 1}. ${r.title}`));

        const evaluationPrompt = `User query: "${userQuery}"

Search results:
${searchResults.map((r, i) => `${i + 1}. "${r.title}" - ${r.url}`).join('\n')}

Rank the top 3-5 most relevant results for answering the user's query.
Return as a simple numbered list with URLs only, e.g:
1. https://example.com
2. https://example.org`;

        const messages: Message[] = [
          {
            id: generateId(),
            role: 'user',
            content: evaluationPrompt,
            timestamp: Date.now(),
          },
        ];

        const response = await AIService.chatCompletion(
          messages,
          {...defaultConfig, maxTokens: 150},
        );

        Logger.debug('Evaluation LLM response:', response);

        // Parse URLs from response
        const urlMatches = response.match(
          /https?:\/\/[^\s\n\)]+/g,
        ) || [];
        const selectedUrls = urlMatches.slice(0, 5);

        Logger.info(`📌 Parsed ${selectedUrls.length} URLs from LLM evaluation`);

        const selectedResults = selectedUrls
          .map(url => searchResults.find(r => r.url === url))
          .filter(Boolean) as SearchResult[];

        if (selectedResults.length === 0) {
          Logger.warn('⚠️ No URLs matched - LLM evaluation may have failed, using first 3 results');
          return {
            analysis: response,
            selectedUrls: searchResults.slice(0, 3),
            count: Math.min(3, searchResults.length),
          };
        }

        Logger.info(`✅ Selected ${selectedResults.length} most relevant pages`);
        Logger.debug('Selected pages:', selectedResults.map(r => r.title));

        return {
          analysis: response,
          selectedUrls: selectedResults,
          count: selectedResults.length,
        };
      },
      onProgress,
    );

    const selectedResults = evaluateStep.result.selectedUrls;
    Logger.info(`🔗 Ready to fetch ${selectedResults.length} pages in parallel`);

    // Step 4: Fetch Pages in Parallel
    const fetchStep = await this.executeStep(
      state,
      'fetch_pages',
      `Fetching ${selectedResults.length} pages in parallel...`,
      async () => {
        const fetchTool = ToolService.getTool('fetch_web_page');
        if (!fetchTool) {
          Logger.error('fetch_web_page tool not found in ToolService');
          throw new Error('fetch_web_page tool not found');
        }

        Logger.info(`⏱️ Starting parallel fetch of ${selectedResults.length} pages...`);
        Logger.info('URLs to fetch:');
        selectedResults.forEach((r: SearchResult, i: number) => {
          Logger.info(`  ${i + 1}. ${r.title}`);
          Logger.debug(`     ${r.url}`);
        });

        // Fetch all pages in parallel
        const fetchStartTime = Date.now();
        const fetchPromises = selectedResults.map((result: SearchResult, index: number) =>
          (async () => {
            try {
              Logger.info(`  📥 Fetching [${index + 1}/${selectedResults.length}]: ${result.title}`);
              const fetchResult = await fetchTool.execute({
                url: result.url,
                extract_prompt: `Extract key information relevant to: "${userQuery}"`,
              });

              if (fetchResult.success) {
                Logger.info(`    ✅ Success - ${fetchResult.content_length} chars extracted`);
                Logger.debug(`    Summary: ${fetchResult.summary.substring(0, 100)}...`);
              } else {
                Logger.warn(`    ❌ Failed - ${fetchResult.error}`);
              }

              return fetchResult;
            } catch (error) {
              Logger.error(`    ❌ Exception fetching ${result.url}:`, error instanceof Error ? error.message : String(error));
              return {
                success: false,
                url: result.url,
                error: error instanceof Error ? error.message : 'Unknown error',
              };
            }
          })(),
        );

        const fetchedPages = await Promise.all(fetchPromises);
        const fetchDuration = Date.now() - fetchStartTime;

        // Filter successful fetches
        const successfulFetches = fetchedPages.filter(
          (p): p is FetchedPage => p.success === true,
        );
        const failedFetches = fetchedPages.filter(p => !p.success);

        Logger.info(`✅ Parallel fetch completed in ${fetchDuration}ms`);
        Logger.info(`📊 Fetch Results: ${successfulFetches.length} succeeded, ${failedFetches.length} failed`);

        if (failedFetches.length > 0) {
          Logger.warn('Failed fetches:');
          failedFetches.forEach(f => {
            Logger.warn(`  - ${f.url}: ${f.error}`);
          });
        }

        return {
          fetched: successfulFetches,
          failed: failedFetches,
          count: successfulFetches.length,
        };
      },
      onProgress,
    );

    const fetchedPages: FetchedPage[] = fetchStep.result.fetched;
    Logger.info(`🎁 Fetched content from ${fetchedPages.length} pages - ready for synthesis`);

    // Step 5: Synthesize Results
    const synthesizeStep = await this.executeStep(
      state,
      'synthesize',
      'Synthesizing final answer...',
      async () => {
        Logger.info('🤝 Synthesizing final answer from fetched content...');
        Logger.info(`📚 Using ${fetchedPages.length} sources for synthesis`);

        const synthesisPrompt = `User query: "${userQuery}"

Here is information from ${fetchedPages.length} relevant web pages:

${fetchedPages
  .map(
    (page, i) => `
[Source ${i + 1}: ${page.title}]
URL: ${page.url}
${page.summary}
`,
  )
  .join('\n')}

Please provide a comprehensive answer to the user's query, synthesizing information from these sources.
Include citations like [Source N] when referencing information.
Be accurate, concise, and helpful.`;

        Logger.debug(`Synthesis prompt length: ${synthesisPrompt.length} chars`);

        const messages: Message[] = [
          {
            id: generateId(),
            role: 'user',
            content: synthesisPrompt,
            timestamp: Date.now(),
          },
        ];

        Logger.info('🧠 Calling LLM for final synthesis...');
        const response = await AIService.chatCompletion(
          messages,
          {...defaultConfig, maxTokens: 800},
        );

        Logger.info(`✅ Synthesis complete - ${response.length} chars generated`);
        Logger.debug(`Response preview: ${response.substring(0, 150)}...`);

        const sources = fetchedPages.map(p => ({
          title: p.title,
          url: p.url,
        }));

        Logger.info(`📖 Final sources for citation:`, sources.length);
        Logger.debug('Sources:', sources);

        return {
          synthesis: response,
          sources,
        };
      },
      onProgress,
    );

    Logger.info('═══════════════════════════════════════════════════════════');
    Logger.info('🎉 ORCHESTRATION COMPLETE');
    Logger.info(`✅ Response: ${synthesizeStep.result.synthesis.substring(0, 100)}...`);
    Logger.info(`📍 Citations: ${synthesizeStep.result.sources.length} sources`);
    Logger.info('═══════════════════════════════════════════════════════════');

    return {
      success: true,
      response: synthesizeStep.result.synthesis,
      state,
      citations: synthesizeStep.result.sources,
      duration: 0,
    };
  }

  /**
   * Execute a single orchestration step with error handling and logging
   */
  private static async executeStep(
    state: OrchestrationState,
    stepName: string,
    description: string,
    executor: () => Promise<any>,
    onProgress?: (step: OrchestrationStep) => void,
  ): Promise<OrchestrationStep> {
    const step: OrchestrationStep = {
      id: generateId(),
      name: stepName,
      status: 'running',
      startTime: Date.now(),
    };

    Logger.info(`→ ${description}`);
    state.steps.push(step);

    if (onProgress) {
      onProgress(step);
    }

    try {
      Logger.debug(`Starting step: ${stepName}`);
      step.result = await executor();
      step.status = 'completed';
      step.endTime = Date.now();
      step.duration = step.endTime - (step.startTime || 0);

      Logger.info(`  ✓ ${stepName} completed in ${step.duration}ms`);
      Logger.debug(`Result type: ${typeof step.result}, keys: ${Object.keys(step.result || {}).join(', ')}`);

      if (onProgress) {
        onProgress(step);
      }

      return step;
    } catch (error) {
      step.status = 'failed';
      step.endTime = Date.now();
      step.duration = step.endTime - (step.startTime || 0);
      step.error = error instanceof Error ? error.message : String(error);

      Logger.error(`  ✗ ${stepName} failed after ${step.duration}ms: ${step.error}`);
      Logger.debug(`Step error details:`, {
        stepName,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : String(error),
      });

      if (onProgress) {
        onProgress(step);
      }

      throw error;
    }
  }

  /**
   * Get workflow state (for debugging/inspection)
   */
  static getWorkflowState(workflowId: string): OrchestrationState | undefined {
    return this.state.get(workflowId);
  }

  /**
   * Clear completed workflows from memory
   */
  static clearWorkflow(workflowId: string): void {
    this.state.delete(workflowId);
  }

  /**
   * Get all active workflows
   */
  static getActiveWorkflows(): string[] {
    return Array.from(this.state.keys());
  }
}
