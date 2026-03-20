
/**
 * @categoryDescription Factory
A collection of utility functions and types for model-specific token handling.
 *
 * @showCategories
 */

import {
  AutoConfig,
  AutoModelForTokenClassification,
  AutoTokenizer,
  PretrainedConfig,
  TransformersJSConfig,
} from "@huggingface/transformers";
import { Tiktoken } from "js-tiktoken";

import { PromptCompressorCore } from "./prompt-compressor.js";
import {
  get_pure_tokens_bert_base_multilingual_cased,
  get_pure_tokens_xlm_roberta_large,
  is_begin_of_new_word_bert_base_multilingual_cased,
  is_begin_of_new_word_xlm_roberta_large,
  Logger,
} from "./utils.js";

type PreTrainedTokenizerOptions = Parameters<
  typeof AutoTokenizer.from_pretrained
>[1];
type PretrainedModelOptions = Parameters<
  typeof AutoModelForTokenClassification.from_pretrained
>[1];

async function prepareDependencies(
  modelName: string,
  transformerJSConfig: TransformersJSConfig,
  logger: Logger,

  pretrainedConfig?: PretrainedConfig | null,
  pretrainedTokenizerOptions?: PreTrainedTokenizerOptions | null,
  modelSpecificOptions?: PretrainedModelOptions | null
) {
  const config =
    pretrainedConfig ?? (await AutoConfig.from_pretrained(modelName));
  logger({ config });

  const tokenizerConfig = {
    config: {
      ...config,
      ...(transformerJSConfig
        ? { "transformers.js_config": transformerJSConfig }
        : {}),
    },
    ...pretrainedTokenizerOptions,
  };
  logger({ tokenizerConfig });

  const tokenizer = await AutoTokenizer.from_pretrained(
    modelName,
    tokenizerConfig
  );
  logger({ tokenizer });

  const modelConfig = {
    config: {
      ...config,
      ...(transformerJSConfig
        ? { "transformers.js_config": transformerJSConfig }
        : {}),
    },
    ...modelSpecificOptions,
  };
  logger({ modelConfig });

  const model = await AutoModelForTokenClassification.from_pretrained(
    modelName,
    modelConfig
  );
  logger({ model });

  return { model, tokenizer, config };
}

/**
 * Options for the compression factory functions.
 *
 * @category Factory
 */
export interface CompressionFactoryOptions {
  /**
   * Configuration for Transformers.js.
   */
  transformerJSConfig: TransformersJSConfig;

  /**
   * The tokenizer to use calculating the compression rate.
   */
  oaiTokenizer: Tiktoken;

  /**
   * Optional pretrained configuration.
   */
  pretrainedConfig?: PretrainedConfig | null;

  /**
   * Optional pretrained tokenizer options.
   */
  pretrainedTokenizerOptions?: PreTrainedTokenizerOptions | null;

  /**
   * Optional model-specific options.
   */
  modelSpecificOptions?: PretrainedModelOptions | null;

  /**
   * Optional logger function.
   */
  logger?: Logger;
}

/**
 * Return type for the compression factory functions. Use `promptCompressor` to compress prompts.
 *
 * @category Factory
 */
export interface CompressionFactoryResult {
  /**
   * Instance of the prompt compressor.
   *
   * @see {@link PromptCompressorCore}
   */
  promptCompressor: PromptCompressorCore;

  /**
   * The model used for token classification.
   */
  model: AutoModelForTokenClassification;

  /**
   * The tokenizer used for tokenization.
   */
  tokenizer: AutoTokenizer;

  /**
   * The configuration used for the model.
   */
  config: AutoConfig;
}

/**
 * Factory functions to create instances of the prompt compressor
 * with XLM-RoBERTa model.
 *
 * @category Factory
 * 
 * @example 
* ```ts
import { CompressionEngine } from "./index.js";

import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";

const modelName = "your-model-id";
const oai_tokenizer = new Tiktoken(o200k_base);

const { promptCompressor } = await CompressionEngine.WithXLMRoBERTa(modelName,
  {
    transformerJSConfig: {
      device: "auto",
      dtype: "fp32",
    },
    oaiTokenizer: oai_tokenizer,
    modelSpecificOptions: {
      use_external_data_format: true,
    },
  }
);

const compressedText: string = await promptCompressor.compress_prompt(
  "A long prompt that you want to compress.",
  { rate: 0.8 }
);

console.log({ compressedText });
```
 */
export async function WithXLMRoBERTa(
  modelName: string,
  options: CompressionFactoryOptions
): Promise<CompressionFactoryResult> {
  const {
    transformerJSConfig,
    oaiTokenizer,
    pretrainedConfig,
    pretrainedTokenizerOptions,
    modelSpecificOptions,
    logger = console.log,
  } = options;

  const { model, tokenizer, config } = await prepareDependencies(
    modelName,
    transformerJSConfig,
    logger,
    pretrainedConfig,
    pretrainedTokenizerOptions,
    modelSpecificOptions
  );

  const promptCompressor = new PromptCompressorCore(
    model,
    tokenizer,
    get_pure_tokens_xlm_roberta_large,
    is_begin_of_new_word_xlm_roberta_large,
    oaiTokenizer
  );

  logger({ promptCompressor });

  return {
    promptCompressor,
    model,
    tokenizer,
    config,
  };
}

/**
 * Factory functions to create instances of the prompt compressor
 * with BERT Multilingual model.
 *
 * @category Factory
 * 
 * @example 
* ```ts
import { CompressionEngine } from "./index.js";

import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";

const modelName = "your-model-id";
const oai_tokenizer = new Tiktoken(o200k_base);

const { promptCompressor } = await CompressionEngine.WithBERTMultilingual(modelName,
  {
    transformerJSConfig: {
      device: "auto",
      dtype: "fp32",
    },
    oaiTokenizer: oai_tokenizer,
    modelSpecificOptions: {
      subfolder: "",
    },
  }
);

const compressedText: string = await promptCompressor.compress_prompt(
  "A long prompt that you want to compress.",
  { rate: 0.8 }
);

console.log({ compressedText });
```
 */
export async function WithBERTMultilingual(
  modelName: string,
  options: CompressionFactoryOptions
): Promise<CompressionFactoryResult> {
  const {
    transformerJSConfig,
    oaiTokenizer,
    pretrainedConfig,
    pretrainedTokenizerOptions,
    modelSpecificOptions,
    logger = console.log,
  } = options;

  const { model, tokenizer, config } = await prepareDependencies(
    modelName,
    transformerJSConfig,
    logger,
    pretrainedConfig,
    pretrainedTokenizerOptions,
    modelSpecificOptions
  );

  const promptCompressor = new PromptCompressorCore(
    model,
    tokenizer,
    get_pure_tokens_bert_base_multilingual_cased,
    is_begin_of_new_word_bert_base_multilingual_cased,
    oaiTokenizer
  );

  logger({ promptCompressor });

  return {
    promptCompressor,
    model,
    tokenizer,
    config,
  };
}
