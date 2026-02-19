import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable, redirect } from "@remix-run/node";
import { RemixServer, Outlet, Meta, Links, ScrollRestoration, Scripts, useOutletContext, useParams, useNavigate, useLocation, Link, useSearchParams } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import * as React from "react";
import React__default, { forwardRef, createElement, useLayoutEffect, useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as ReactDOM from "react-dom";
import ReactDOM__default from "react-dom";
import https from "https";
import http from "http";
import { readFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";
const ABORT_DELAY = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  return isbot(request.headers.get("user-agent") || "") ? handleBotRequest(
    request,
    responseStatusCode,
    responseHeaders,
    remixContext
  ) : handleBrowserRequest(
    request,
    responseStatusCode,
    responseHeaders,
    remixContext
  );
}
function handleBotRequest(request, responseStatusCode, responseHeaders, remixContext) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(
        RemixServer,
        {
          context: remixContext,
          url: request.url,
          abortDelay: ABORT_DELAY
        }
      ),
      {
        onAllReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
    setTimeout(abort, ABORT_DELAY);
  });
}
function handleBrowserRequest(request, responseStatusCode, responseHeaders, remixContext) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(
        RemixServer,
        {
          context: remixContext,
          url: request.url,
          abortDelay: ABORT_DELAY
        }
      ),
      {
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
    setTimeout(abort, ABORT_DELAY);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: "Module" }));
const indexStyles = "/assets/index-AsrsOJC9.css";
const links = () => [
  { rel: "stylesheet", href: indexStyles }
];
const meta = () => {
  return [
    { title: "Activity Explorer" },
    { name: "description", content: "Explore audit logs and activities" }
  ];
};
const themeScript = `
  (function() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.classList.add('dark');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
  })();
`;
function Layout({ children }) {
  return /* @__PURE__ */ jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      /* @__PURE__ */ jsx("script", { dangerouslySetInnerHTML: { __html: themeScript } }),
      /* @__PURE__ */ jsx(Meta, {}),
      /* @__PURE__ */ jsx(Links, {})
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      children,
      /* @__PURE__ */ jsx(ScrollRestoration, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
function App() {
  return /* @__PURE__ */ jsx(Outlet, {});
}
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Layout,
  default: App,
  links,
  meta
}, Symbol.toStringTag, { value: "Module" }));
function r(e) {
  var t, f, n = "";
  if ("string" == typeof e || "number" == typeof e) n += e;
  else if ("object" == typeof e) if (Array.isArray(e)) {
    var o = e.length;
    for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
  } else for (f in e) e[f] && (n && (n += " "), n += f);
  return n;
}
function clsx() {
  for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
  return n;
}
const falsyToString = (value) => typeof value === "boolean" ? `${value}` : value === 0 ? "0" : value;
const cx = clsx;
const cva = (base, config) => (props) => {
  var _config_compoundVariants;
  if ((config === null || config === void 0 ? void 0 : config.variants) == null) return cx(base, props === null || props === void 0 ? void 0 : props.class, props === null || props === void 0 ? void 0 : props.className);
  const { variants, defaultVariants } = config;
  const getVariantClassNames = Object.keys(variants).map((variant) => {
    const variantProp = props === null || props === void 0 ? void 0 : props[variant];
    const defaultVariantProp = defaultVariants === null || defaultVariants === void 0 ? void 0 : defaultVariants[variant];
    if (variantProp === null) return null;
    const variantKey = falsyToString(variantProp) || falsyToString(defaultVariantProp);
    return variants[variant][variantKey];
  });
  const propsWithoutUndefined = props && Object.entries(props).reduce((acc, param) => {
    let [key, value] = param;
    if (value === void 0) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
  const getCompoundVariantClassNames = config === null || config === void 0 ? void 0 : (_config_compoundVariants = config.compoundVariants) === null || _config_compoundVariants === void 0 ? void 0 : _config_compoundVariants.reduce((acc, param) => {
    let { class: cvClass, className: cvClassName, ...compoundVariantOptions } = param;
    return Object.entries(compoundVariantOptions).every((param2) => {
      let [key, value] = param2;
      return Array.isArray(value) ? value.includes({
        ...defaultVariants,
        ...propsWithoutUndefined
      }[key]) : {
        ...defaultVariants,
        ...propsWithoutUndefined
      }[key] === value;
    }) ? [
      ...acc,
      cvClass,
      cvClassName
    ] : acc;
  }, []);
  return cx(base, getVariantClassNames, getCompoundVariantClassNames, props === null || props === void 0 ? void 0 : props.class, props === null || props === void 0 ? void 0 : props.className);
};
const concatArrays = (array1, array2) => {
  const combinedArray = new Array(array1.length + array2.length);
  for (let i = 0; i < array1.length; i++) {
    combinedArray[i] = array1[i];
  }
  for (let i = 0; i < array2.length; i++) {
    combinedArray[array1.length + i] = array2[i];
  }
  return combinedArray;
};
const createClassValidatorObject = (classGroupId, validator) => ({
  classGroupId,
  validator
});
const createClassPartObject = (nextPart = /* @__PURE__ */ new Map(), validators = null, classGroupId) => ({
  nextPart,
  validators,
  classGroupId
});
const CLASS_PART_SEPARATOR = "-";
const EMPTY_CONFLICTS = [];
const ARBITRARY_PROPERTY_PREFIX = "arbitrary..";
const createClassGroupUtils = (config) => {
  const classMap = createClassMap(config);
  const {
    conflictingClassGroups,
    conflictingClassGroupModifiers
  } = config;
  const getClassGroupId = (className) => {
    if (className.startsWith("[") && className.endsWith("]")) {
      return getGroupIdForArbitraryProperty(className);
    }
    const classParts = className.split(CLASS_PART_SEPARATOR);
    const startIndex = classParts[0] === "" && classParts.length > 1 ? 1 : 0;
    return getGroupRecursive(classParts, startIndex, classMap);
  };
  const getConflictingClassGroupIds = (classGroupId, hasPostfixModifier) => {
    if (hasPostfixModifier) {
      const modifierConflicts = conflictingClassGroupModifiers[classGroupId];
      const baseConflicts = conflictingClassGroups[classGroupId];
      if (modifierConflicts) {
        if (baseConflicts) {
          return concatArrays(baseConflicts, modifierConflicts);
        }
        return modifierConflicts;
      }
      return baseConflicts || EMPTY_CONFLICTS;
    }
    return conflictingClassGroups[classGroupId] || EMPTY_CONFLICTS;
  };
  return {
    getClassGroupId,
    getConflictingClassGroupIds
  };
};
const getGroupRecursive = (classParts, startIndex, classPartObject) => {
  const classPathsLength = classParts.length - startIndex;
  if (classPathsLength === 0) {
    return classPartObject.classGroupId;
  }
  const currentClassPart = classParts[startIndex];
  const nextClassPartObject = classPartObject.nextPart.get(currentClassPart);
  if (nextClassPartObject) {
    const result = getGroupRecursive(classParts, startIndex + 1, nextClassPartObject);
    if (result) return result;
  }
  const validators = classPartObject.validators;
  if (validators === null) {
    return void 0;
  }
  const classRest = startIndex === 0 ? classParts.join(CLASS_PART_SEPARATOR) : classParts.slice(startIndex).join(CLASS_PART_SEPARATOR);
  const validatorsLength = validators.length;
  for (let i = 0; i < validatorsLength; i++) {
    const validatorObj = validators[i];
    if (validatorObj.validator(classRest)) {
      return validatorObj.classGroupId;
    }
  }
  return void 0;
};
const getGroupIdForArbitraryProperty = (className) => className.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const content = className.slice(1, -1);
  const colonIndex = content.indexOf(":");
  const property = content.slice(0, colonIndex);
  return property ? ARBITRARY_PROPERTY_PREFIX + property : void 0;
})();
const createClassMap = (config) => {
  const {
    theme,
    classGroups
  } = config;
  return processClassGroups(classGroups, theme);
};
const processClassGroups = (classGroups, theme) => {
  const classMap = createClassPartObject();
  for (const classGroupId in classGroups) {
    const group = classGroups[classGroupId];
    processClassesRecursively(group, classMap, classGroupId, theme);
  }
  return classMap;
};
const processClassesRecursively = (classGroup, classPartObject, classGroupId, theme) => {
  const len = classGroup.length;
  for (let i = 0; i < len; i++) {
    const classDefinition = classGroup[i];
    processClassDefinition(classDefinition, classPartObject, classGroupId, theme);
  }
};
const processClassDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
  if (typeof classDefinition === "string") {
    processStringDefinition(classDefinition, classPartObject, classGroupId);
    return;
  }
  if (typeof classDefinition === "function") {
    processFunctionDefinition(classDefinition, classPartObject, classGroupId, theme);
    return;
  }
  processObjectDefinition(classDefinition, classPartObject, classGroupId, theme);
};
const processStringDefinition = (classDefinition, classPartObject, classGroupId) => {
  const classPartObjectToEdit = classDefinition === "" ? classPartObject : getPart(classPartObject, classDefinition);
  classPartObjectToEdit.classGroupId = classGroupId;
};
const processFunctionDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
  if (isThemeGetter(classDefinition)) {
    processClassesRecursively(classDefinition(theme), classPartObject, classGroupId, theme);
    return;
  }
  if (classPartObject.validators === null) {
    classPartObject.validators = [];
  }
  classPartObject.validators.push(createClassValidatorObject(classGroupId, classDefinition));
};
const processObjectDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
  const entries = Object.entries(classDefinition);
  const len = entries.length;
  for (let i = 0; i < len; i++) {
    const [key, value] = entries[i];
    processClassesRecursively(value, getPart(classPartObject, key), classGroupId, theme);
  }
};
const getPart = (classPartObject, path) => {
  let current = classPartObject;
  const parts = path.split(CLASS_PART_SEPARATOR);
  const len = parts.length;
  for (let i = 0; i < len; i++) {
    const part = parts[i];
    let next = current.nextPart.get(part);
    if (!next) {
      next = createClassPartObject();
      current.nextPart.set(part, next);
    }
    current = next;
  }
  return current;
};
const isThemeGetter = (func) => "isThemeGetter" in func && func.isThemeGetter === true;
const createLruCache = (maxCacheSize) => {
  if (maxCacheSize < 1) {
    return {
      get: () => void 0,
      set: () => {
      }
    };
  }
  let cacheSize = 0;
  let cache = /* @__PURE__ */ Object.create(null);
  let previousCache = /* @__PURE__ */ Object.create(null);
  const update = (key, value) => {
    cache[key] = value;
    cacheSize++;
    if (cacheSize > maxCacheSize) {
      cacheSize = 0;
      previousCache = cache;
      cache = /* @__PURE__ */ Object.create(null);
    }
  };
  return {
    get(key) {
      let value = cache[key];
      if (value !== void 0) {
        return value;
      }
      if ((value = previousCache[key]) !== void 0) {
        update(key, value);
        return value;
      }
    },
    set(key, value) {
      if (key in cache) {
        cache[key] = value;
      } else {
        update(key, value);
      }
    }
  };
};
const IMPORTANT_MODIFIER = "!";
const MODIFIER_SEPARATOR = ":";
const EMPTY_MODIFIERS = [];
const createResultObject = (modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition, isExternal) => ({
  modifiers,
  hasImportantModifier,
  baseClassName,
  maybePostfixModifierPosition,
  isExternal
});
const createParseClassName = (config) => {
  const {
    prefix,
    experimentalParseClassName
  } = config;
  let parseClassName = (className) => {
    const modifiers = [];
    let bracketDepth = 0;
    let parenDepth = 0;
    let modifierStart = 0;
    let postfixModifierPosition;
    const len = className.length;
    for (let index2 = 0; index2 < len; index2++) {
      const currentCharacter = className[index2];
      if (bracketDepth === 0 && parenDepth === 0) {
        if (currentCharacter === MODIFIER_SEPARATOR) {
          modifiers.push(className.slice(modifierStart, index2));
          modifierStart = index2 + 1;
          continue;
        }
        if (currentCharacter === "/") {
          postfixModifierPosition = index2;
          continue;
        }
      }
      if (currentCharacter === "[") bracketDepth++;
      else if (currentCharacter === "]") bracketDepth--;
      else if (currentCharacter === "(") parenDepth++;
      else if (currentCharacter === ")") parenDepth--;
    }
    const baseClassNameWithImportantModifier = modifiers.length === 0 ? className : className.slice(modifierStart);
    let baseClassName = baseClassNameWithImportantModifier;
    let hasImportantModifier = false;
    if (baseClassNameWithImportantModifier.endsWith(IMPORTANT_MODIFIER)) {
      baseClassName = baseClassNameWithImportantModifier.slice(0, -1);
      hasImportantModifier = true;
    } else if (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      baseClassNameWithImportantModifier.startsWith(IMPORTANT_MODIFIER)
    ) {
      baseClassName = baseClassNameWithImportantModifier.slice(1);
      hasImportantModifier = true;
    }
    const maybePostfixModifierPosition = postfixModifierPosition && postfixModifierPosition > modifierStart ? postfixModifierPosition - modifierStart : void 0;
    return createResultObject(modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition);
  };
  if (prefix) {
    const fullPrefix = prefix + MODIFIER_SEPARATOR;
    const parseClassNameOriginal = parseClassName;
    parseClassName = (className) => className.startsWith(fullPrefix) ? parseClassNameOriginal(className.slice(fullPrefix.length)) : createResultObject(EMPTY_MODIFIERS, false, className, void 0, true);
  }
  if (experimentalParseClassName) {
    const parseClassNameOriginal = parseClassName;
    parseClassName = (className) => experimentalParseClassName({
      className,
      parseClassName: parseClassNameOriginal
    });
  }
  return parseClassName;
};
const createSortModifiers = (config) => {
  const modifierWeights = /* @__PURE__ */ new Map();
  config.orderSensitiveModifiers.forEach((mod, index2) => {
    modifierWeights.set(mod, 1e6 + index2);
  });
  return (modifiers) => {
    const result = [];
    let currentSegment = [];
    for (let i = 0; i < modifiers.length; i++) {
      const modifier = modifiers[i];
      const isArbitrary = modifier[0] === "[";
      const isOrderSensitive = modifierWeights.has(modifier);
      if (isArbitrary || isOrderSensitive) {
        if (currentSegment.length > 0) {
          currentSegment.sort();
          result.push(...currentSegment);
          currentSegment = [];
        }
        result.push(modifier);
      } else {
        currentSegment.push(modifier);
      }
    }
    if (currentSegment.length > 0) {
      currentSegment.sort();
      result.push(...currentSegment);
    }
    return result;
  };
};
const createConfigUtils = (config) => ({
  cache: createLruCache(config.cacheSize),
  parseClassName: createParseClassName(config),
  sortModifiers: createSortModifiers(config),
  ...createClassGroupUtils(config)
});
const SPLIT_CLASSES_REGEX = /\s+/;
const mergeClassList = (classList, configUtils) => {
  const {
    parseClassName,
    getClassGroupId,
    getConflictingClassGroupIds,
    sortModifiers
  } = configUtils;
  const classGroupsInConflict = [];
  const classNames = classList.trim().split(SPLIT_CLASSES_REGEX);
  let result = "";
  for (let index2 = classNames.length - 1; index2 >= 0; index2 -= 1) {
    const originalClassName = classNames[index2];
    const {
      isExternal,
      modifiers,
      hasImportantModifier,
      baseClassName,
      maybePostfixModifierPosition
    } = parseClassName(originalClassName);
    if (isExternal) {
      result = originalClassName + (result.length > 0 ? " " + result : result);
      continue;
    }
    let hasPostfixModifier = !!maybePostfixModifierPosition;
    let classGroupId = getClassGroupId(hasPostfixModifier ? baseClassName.substring(0, maybePostfixModifierPosition) : baseClassName);
    if (!classGroupId) {
      if (!hasPostfixModifier) {
        result = originalClassName + (result.length > 0 ? " " + result : result);
        continue;
      }
      classGroupId = getClassGroupId(baseClassName);
      if (!classGroupId) {
        result = originalClassName + (result.length > 0 ? " " + result : result);
        continue;
      }
      hasPostfixModifier = false;
    }
    const variantModifier = modifiers.length === 0 ? "" : modifiers.length === 1 ? modifiers[0] : sortModifiers(modifiers).join(":");
    const modifierId = hasImportantModifier ? variantModifier + IMPORTANT_MODIFIER : variantModifier;
    const classId = modifierId + classGroupId;
    if (classGroupsInConflict.indexOf(classId) > -1) {
      continue;
    }
    classGroupsInConflict.push(classId);
    const conflictGroups = getConflictingClassGroupIds(classGroupId, hasPostfixModifier);
    for (let i = 0; i < conflictGroups.length; ++i) {
      const group = conflictGroups[i];
      classGroupsInConflict.push(modifierId + group);
    }
    result = originalClassName + (result.length > 0 ? " " + result : result);
  }
  return result;
};
const twJoin = (...classLists) => {
  let index2 = 0;
  let argument;
  let resolvedValue;
  let string = "";
  while (index2 < classLists.length) {
    if (argument = classLists[index2++]) {
      if (resolvedValue = toValue(argument)) {
        string && (string += " ");
        string += resolvedValue;
      }
    }
  }
  return string;
};
const toValue = (mix) => {
  if (typeof mix === "string") {
    return mix;
  }
  let resolvedValue;
  let string = "";
  for (let k2 = 0; k2 < mix.length; k2++) {
    if (mix[k2]) {
      if (resolvedValue = toValue(mix[k2])) {
        string && (string += " ");
        string += resolvedValue;
      }
    }
  }
  return string;
};
const createTailwindMerge = (createConfigFirst, ...createConfigRest) => {
  let configUtils;
  let cacheGet;
  let cacheSet;
  let functionToCall;
  const initTailwindMerge = (classList) => {
    const config = createConfigRest.reduce((previousConfig, createConfigCurrent) => createConfigCurrent(previousConfig), createConfigFirst());
    configUtils = createConfigUtils(config);
    cacheGet = configUtils.cache.get;
    cacheSet = configUtils.cache.set;
    functionToCall = tailwindMerge;
    return tailwindMerge(classList);
  };
  const tailwindMerge = (classList) => {
    const cachedResult = cacheGet(classList);
    if (cachedResult) {
      return cachedResult;
    }
    const result = mergeClassList(classList, configUtils);
    cacheSet(classList, result);
    return result;
  };
  functionToCall = initTailwindMerge;
  return (...args) => functionToCall(twJoin(...args));
};
const fallbackThemeArr = [];
const fromTheme = (key) => {
  const themeGetter = (theme) => theme[key] || fallbackThemeArr;
  themeGetter.isThemeGetter = true;
  return themeGetter;
};
const arbitraryValueRegex = /^\[(?:(\w[\w-]*):)?(.+)\]$/i;
const arbitraryVariableRegex = /^\((?:(\w[\w-]*):)?(.+)\)$/i;
const fractionRegex = /^\d+\/\d+$/;
const tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
const lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
const colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/;
const shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
const imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
const isFraction = (value) => fractionRegex.test(value);
const isNumber = (value) => !!value && !Number.isNaN(Number(value));
const isInteger = (value) => !!value && Number.isInteger(Number(value));
const isPercent = (value) => value.endsWith("%") && isNumber(value.slice(0, -1));
const isTshirtSize = (value) => tshirtUnitRegex.test(value);
const isAny = () => true;
const isLengthOnly = (value) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  lengthUnitRegex.test(value) && !colorFunctionRegex.test(value)
);
const isNever = () => false;
const isShadow = (value) => shadowRegex.test(value);
const isImage = (value) => imageRegex.test(value);
const isAnyNonArbitrary = (value) => !isArbitraryValue(value) && !isArbitraryVariable(value);
const isArbitrarySize = (value) => getIsArbitraryValue(value, isLabelSize, isNever);
const isArbitraryValue = (value) => arbitraryValueRegex.test(value);
const isArbitraryLength = (value) => getIsArbitraryValue(value, isLabelLength, isLengthOnly);
const isArbitraryNumber = (value) => getIsArbitraryValue(value, isLabelNumber, isNumber);
const isArbitraryPosition = (value) => getIsArbitraryValue(value, isLabelPosition, isNever);
const isArbitraryImage = (value) => getIsArbitraryValue(value, isLabelImage, isImage);
const isArbitraryShadow = (value) => getIsArbitraryValue(value, isLabelShadow, isShadow);
const isArbitraryVariable = (value) => arbitraryVariableRegex.test(value);
const isArbitraryVariableLength = (value) => getIsArbitraryVariable(value, isLabelLength);
const isArbitraryVariableFamilyName = (value) => getIsArbitraryVariable(value, isLabelFamilyName);
const isArbitraryVariablePosition = (value) => getIsArbitraryVariable(value, isLabelPosition);
const isArbitraryVariableSize = (value) => getIsArbitraryVariable(value, isLabelSize);
const isArbitraryVariableImage = (value) => getIsArbitraryVariable(value, isLabelImage);
const isArbitraryVariableShadow = (value) => getIsArbitraryVariable(value, isLabelShadow, true);
const getIsArbitraryValue = (value, testLabel, testValue) => {
  const result = arbitraryValueRegex.exec(value);
  if (result) {
    if (result[1]) {
      return testLabel(result[1]);
    }
    return testValue(result[2]);
  }
  return false;
};
const getIsArbitraryVariable = (value, testLabel, shouldMatchNoLabel = false) => {
  const result = arbitraryVariableRegex.exec(value);
  if (result) {
    if (result[1]) {
      return testLabel(result[1]);
    }
    return shouldMatchNoLabel;
  }
  return false;
};
const isLabelPosition = (label) => label === "position" || label === "percentage";
const isLabelImage = (label) => label === "image" || label === "url";
const isLabelSize = (label) => label === "length" || label === "size" || label === "bg-size";
const isLabelLength = (label) => label === "length";
const isLabelNumber = (label) => label === "number";
const isLabelFamilyName = (label) => label === "family-name";
const isLabelShadow = (label) => label === "shadow";
const getDefaultConfig = () => {
  const themeColor = fromTheme("color");
  const themeFont = fromTheme("font");
  const themeText = fromTheme("text");
  const themeFontWeight = fromTheme("font-weight");
  const themeTracking = fromTheme("tracking");
  const themeLeading = fromTheme("leading");
  const themeBreakpoint = fromTheme("breakpoint");
  const themeContainer = fromTheme("container");
  const themeSpacing = fromTheme("spacing");
  const themeRadius = fromTheme("radius");
  const themeShadow = fromTheme("shadow");
  const themeInsetShadow = fromTheme("inset-shadow");
  const themeTextShadow = fromTheme("text-shadow");
  const themeDropShadow = fromTheme("drop-shadow");
  const themeBlur = fromTheme("blur");
  const themePerspective = fromTheme("perspective");
  const themeAspect = fromTheme("aspect");
  const themeEase = fromTheme("ease");
  const themeAnimate = fromTheme("animate");
  const scaleBreak = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"];
  const scalePosition = () => [
    "center",
    "top",
    "bottom",
    "left",
    "right",
    "top-left",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "left-top",
    "top-right",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "right-top",
    "bottom-right",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "right-bottom",
    "bottom-left",
    // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
    "left-bottom"
  ];
  const scalePositionWithArbitrary = () => [...scalePosition(), isArbitraryVariable, isArbitraryValue];
  const scaleOverflow = () => ["auto", "hidden", "clip", "visible", "scroll"];
  const scaleOverscroll = () => ["auto", "contain", "none"];
  const scaleUnambiguousSpacing = () => [isArbitraryVariable, isArbitraryValue, themeSpacing];
  const scaleInset = () => [isFraction, "full", "auto", ...scaleUnambiguousSpacing()];
  const scaleGridTemplateColsRows = () => [isInteger, "none", "subgrid", isArbitraryVariable, isArbitraryValue];
  const scaleGridColRowStartAndEnd = () => ["auto", {
    span: ["full", isInteger, isArbitraryVariable, isArbitraryValue]
  }, isInteger, isArbitraryVariable, isArbitraryValue];
  const scaleGridColRowStartOrEnd = () => [isInteger, "auto", isArbitraryVariable, isArbitraryValue];
  const scaleGridAutoColsRows = () => ["auto", "min", "max", "fr", isArbitraryVariable, isArbitraryValue];
  const scaleAlignPrimaryAxis = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"];
  const scaleAlignSecondaryAxis = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"];
  const scaleMargin = () => ["auto", ...scaleUnambiguousSpacing()];
  const scaleSizing = () => [isFraction, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...scaleUnambiguousSpacing()];
  const scaleColor = () => [themeColor, isArbitraryVariable, isArbitraryValue];
  const scaleBgPosition = () => [...scalePosition(), isArbitraryVariablePosition, isArbitraryPosition, {
    position: [isArbitraryVariable, isArbitraryValue]
  }];
  const scaleBgRepeat = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }];
  const scaleBgSize = () => ["auto", "cover", "contain", isArbitraryVariableSize, isArbitrarySize, {
    size: [isArbitraryVariable, isArbitraryValue]
  }];
  const scaleGradientStopPosition = () => [isPercent, isArbitraryVariableLength, isArbitraryLength];
  const scaleRadius = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    themeRadius,
    isArbitraryVariable,
    isArbitraryValue
  ];
  const scaleBorderWidth = () => ["", isNumber, isArbitraryVariableLength, isArbitraryLength];
  const scaleLineStyle = () => ["solid", "dashed", "dotted", "double"];
  const scaleBlendMode = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
  const scaleMaskImagePosition = () => [isNumber, isPercent, isArbitraryVariablePosition, isArbitraryPosition];
  const scaleBlur = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    themeBlur,
    isArbitraryVariable,
    isArbitraryValue
  ];
  const scaleRotate = () => ["none", isNumber, isArbitraryVariable, isArbitraryValue];
  const scaleScale = () => ["none", isNumber, isArbitraryVariable, isArbitraryValue];
  const scaleSkew = () => [isNumber, isArbitraryVariable, isArbitraryValue];
  const scaleTranslate = () => [isFraction, "full", ...scaleUnambiguousSpacing()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [isTshirtSize],
      breakpoint: [isTshirtSize],
      color: [isAny],
      container: [isTshirtSize],
      "drop-shadow": [isTshirtSize],
      ease: ["in", "out", "in-out"],
      font: [isAnyNonArbitrary],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [isTshirtSize],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [isTshirtSize],
      shadow: [isTshirtSize],
      spacing: ["px", isNumber],
      text: [isTshirtSize],
      "text-shadow": [isTshirtSize],
      tracking: ["tighter", "tight", "normal", "wide", "wider", "widest"]
    },
    classGroups: {
      // --------------
      // --- Layout ---
      // --------------
      /**
       * Aspect Ratio
       * @see https://tailwindcss.com/docs/aspect-ratio
       */
      aspect: [{
        aspect: ["auto", "square", isFraction, isArbitraryValue, isArbitraryVariable, themeAspect]
      }],
      /**
       * Container
       * @see https://tailwindcss.com/docs/container
       * @deprecated since Tailwind CSS v4.0.0
       */
      container: ["container"],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [isNumber, isArbitraryValue, isArbitraryVariable, themeContainer]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": scaleBreak()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": scaleBreak()
      }],
      /**
       * Break Inside
       * @see https://tailwindcss.com/docs/break-inside
       */
      "break-inside": [{
        "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
      }],
      /**
       * Box Decoration Break
       * @see https://tailwindcss.com/docs/box-decoration-break
       */
      "box-decoration": [{
        "box-decoration": ["slice", "clone"]
      }],
      /**
       * Box Sizing
       * @see https://tailwindcss.com/docs/box-sizing
       */
      box: [{
        box: ["border", "content"]
      }],
      /**
       * Display
       * @see https://tailwindcss.com/docs/display
       */
      display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
      /**
       * Screen Reader Only
       * @see https://tailwindcss.com/docs/display#screen-reader-only
       */
      sr: ["sr-only", "not-sr-only"],
      /**
       * Floats
       * @see https://tailwindcss.com/docs/float
       */
      float: [{
        float: ["right", "left", "none", "start", "end"]
      }],
      /**
       * Clear
       * @see https://tailwindcss.com/docs/clear
       */
      clear: [{
        clear: ["left", "right", "both", "none", "start", "end"]
      }],
      /**
       * Isolation
       * @see https://tailwindcss.com/docs/isolation
       */
      isolation: ["isolate", "isolation-auto"],
      /**
       * Object Fit
       * @see https://tailwindcss.com/docs/object-fit
       */
      "object-fit": [{
        object: ["contain", "cover", "fill", "none", "scale-down"]
      }],
      /**
       * Object Position
       * @see https://tailwindcss.com/docs/object-position
       */
      "object-position": [{
        object: scalePositionWithArbitrary()
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: scaleOverflow()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": scaleOverflow()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": scaleOverflow()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: scaleOverscroll()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": scaleOverscroll()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": scaleOverscroll()
      }],
      /**
       * Position
       * @see https://tailwindcss.com/docs/position
       */
      position: ["static", "fixed", "absolute", "relative", "sticky"],
      /**
       * Top / Right / Bottom / Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      inset: [{
        inset: scaleInset()
      }],
      /**
       * Right / Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": scaleInset()
      }],
      /**
       * Top / Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": scaleInset()
      }],
      /**
       * Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      start: [{
        start: scaleInset()
      }],
      /**
       * End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      end: [{
        end: scaleInset()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: scaleInset()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: scaleInset()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: scaleInset()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: scaleInset()
      }],
      /**
       * Visibility
       * @see https://tailwindcss.com/docs/visibility
       */
      visibility: ["visible", "invisible", "collapse"],
      /**
       * Z-Index
       * @see https://tailwindcss.com/docs/z-index
       */
      z: [{
        z: [isInteger, "auto", isArbitraryVariable, isArbitraryValue]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [isFraction, "full", "auto", themeContainer, ...scaleUnambiguousSpacing()]
      }],
      /**
       * Flex Direction
       * @see https://tailwindcss.com/docs/flex-direction
       */
      "flex-direction": [{
        flex: ["row", "row-reverse", "col", "col-reverse"]
      }],
      /**
       * Flex Wrap
       * @see https://tailwindcss.com/docs/flex-wrap
       */
      "flex-wrap": [{
        flex: ["nowrap", "wrap", "wrap-reverse"]
      }],
      /**
       * Flex
       * @see https://tailwindcss.com/docs/flex
       */
      flex: [{
        flex: [isNumber, isFraction, "auto", "initial", "none", isArbitraryValue]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [isInteger, "first", "last", "none", isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": scaleGridTemplateColsRows()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: scaleGridColRowStartAndEnd()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": scaleGridColRowStartOrEnd()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": scaleGridColRowStartOrEnd()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": scaleGridTemplateColsRows()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: scaleGridColRowStartAndEnd()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": scaleGridColRowStartOrEnd()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": scaleGridColRowStartOrEnd()
      }],
      /**
       * Grid Auto Flow
       * @see https://tailwindcss.com/docs/grid-auto-flow
       */
      "grid-flow": [{
        "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
      }],
      /**
       * Grid Auto Columns
       * @see https://tailwindcss.com/docs/grid-auto-columns
       */
      "auto-cols": [{
        "auto-cols": scaleGridAutoColsRows()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": scaleGridAutoColsRows()
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: scaleUnambiguousSpacing()
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": scaleUnambiguousSpacing()
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": scaleUnambiguousSpacing()
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: [...scaleAlignPrimaryAxis(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...scaleAlignSecondaryAxis(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...scaleAlignSecondaryAxis()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...scaleAlignPrimaryAxis()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...scaleAlignSecondaryAxis(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...scaleAlignSecondaryAxis(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": scaleAlignPrimaryAxis()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...scaleAlignSecondaryAxis(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...scaleAlignSecondaryAxis()]
      }],
      // Spacing
      /**
       * Padding
       * @see https://tailwindcss.com/docs/padding
       */
      p: [{
        p: scaleUnambiguousSpacing()
      }],
      /**
       * Padding X
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: scaleUnambiguousSpacing()
      }],
      /**
       * Padding Y
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: scaleUnambiguousSpacing()
      }],
      /**
       * Padding Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: scaleUnambiguousSpacing()
      }],
      /**
       * Padding End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: scaleUnambiguousSpacing()
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: scaleUnambiguousSpacing()
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: scaleUnambiguousSpacing()
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: scaleUnambiguousSpacing()
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: scaleUnambiguousSpacing()
      }],
      /**
       * Margin
       * @see https://tailwindcss.com/docs/margin
       */
      m: [{
        m: scaleMargin()
      }],
      /**
       * Margin X
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: scaleMargin()
      }],
      /**
       * Margin Y
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: scaleMargin()
      }],
      /**
       * Margin Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: scaleMargin()
      }],
      /**
       * Margin End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: scaleMargin()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: scaleMargin()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: scaleMargin()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: scaleMargin()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: scaleMargin()
      }],
      /**
       * Space Between X
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x": [{
        "space-x": scaleUnambiguousSpacing()
      }],
      /**
       * Space Between X Reverse
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-x-reverse": ["space-x-reverse"],
      /**
       * Space Between Y
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-y": [{
        "space-y": scaleUnambiguousSpacing()
      }],
      /**
       * Space Between Y Reverse
       * @see https://tailwindcss.com/docs/margin#adding-space-between-children
       */
      "space-y-reverse": ["space-y-reverse"],
      // --------------
      // --- Sizing ---
      // --------------
      /**
       * Size
       * @see https://tailwindcss.com/docs/width#setting-both-width-and-height
       */
      size: [{
        size: scaleSizing()
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [themeContainer, "screen", ...scaleSizing()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          themeContainer,
          "screen",
          /** Deprecated. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "none",
          ...scaleSizing()
        ]
      }],
      /**
       * Max-Width
       * @see https://tailwindcss.com/docs/max-width
       */
      "max-w": [{
        "max-w": [
          themeContainer,
          "screen",
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "prose",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          {
            screen: [themeBreakpoint]
          },
          ...scaleSizing()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...scaleSizing()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...scaleSizing()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", ...scaleSizing()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", themeText, isArbitraryVariableLength, isArbitraryLength]
      }],
      /**
       * Font Smoothing
       * @see https://tailwindcss.com/docs/font-smoothing
       */
      "font-smoothing": ["antialiased", "subpixel-antialiased"],
      /**
       * Font Style
       * @see https://tailwindcss.com/docs/font-style
       */
      "font-style": ["italic", "not-italic"],
      /**
       * Font Weight
       * @see https://tailwindcss.com/docs/font-weight
       */
      "font-weight": [{
        font: [themeFontWeight, isArbitraryVariable, isArbitraryNumber]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", isPercent, isArbitraryValue]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [isArbitraryVariableFamilyName, isArbitraryValue, themeFont]
      }],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-normal": ["normal-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-ordinal": ["ordinal"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-slashed-zero": ["slashed-zero"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-figure": ["lining-nums", "oldstyle-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-spacing": ["proportional-nums", "tabular-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
      /**
       * Letter Spacing
       * @see https://tailwindcss.com/docs/letter-spacing
       */
      tracking: [{
        tracking: [themeTracking, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [isNumber, "none", isArbitraryVariable, isArbitraryNumber]
      }],
      /**
       * Line Height
       * @see https://tailwindcss.com/docs/line-height
       */
      leading: [{
        leading: [
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          themeLeading,
          ...scaleUnambiguousSpacing()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * List Style Position
       * @see https://tailwindcss.com/docs/list-style-position
       */
      "list-style-position": [{
        list: ["inside", "outside"]
      }],
      /**
       * List Style Type
       * @see https://tailwindcss.com/docs/list-style-type
       */
      "list-style-type": [{
        list: ["disc", "decimal", "none", isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Text Alignment
       * @see https://tailwindcss.com/docs/text-align
       */
      "text-alignment": [{
        text: ["left", "center", "right", "justify", "start", "end"]
      }],
      /**
       * Placeholder Color
       * @deprecated since Tailwind CSS v3.0.0
       * @see https://v3.tailwindcss.com/docs/placeholder-color
       */
      "placeholder-color": [{
        placeholder: scaleColor()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: scaleColor()
      }],
      /**
       * Text Decoration
       * @see https://tailwindcss.com/docs/text-decoration
       */
      "text-decoration": ["underline", "overline", "line-through", "no-underline"],
      /**
       * Text Decoration Style
       * @see https://tailwindcss.com/docs/text-decoration-style
       */
      "text-decoration-style": [{
        decoration: [...scaleLineStyle(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [isNumber, "from-font", "auto", isArbitraryVariable, isArbitraryLength]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: scaleColor()
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": [isNumber, "auto", isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Text Transform
       * @see https://tailwindcss.com/docs/text-transform
       */
      "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
      /**
       * Text Overflow
       * @see https://tailwindcss.com/docs/text-overflow
       */
      "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
      /**
       * Text Wrap
       * @see https://tailwindcss.com/docs/text-wrap
       */
      "text-wrap": [{
        text: ["wrap", "nowrap", "balance", "pretty"]
      }],
      /**
       * Text Indent
       * @see https://tailwindcss.com/docs/text-indent
       */
      indent: [{
        indent: scaleUnambiguousSpacing()
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Whitespace
       * @see https://tailwindcss.com/docs/whitespace
       */
      whitespace: [{
        whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
      }],
      /**
       * Word Break
       * @see https://tailwindcss.com/docs/word-break
       */
      break: [{
        break: ["normal", "words", "all", "keep"]
      }],
      /**
       * Overflow Wrap
       * @see https://tailwindcss.com/docs/overflow-wrap
       */
      wrap: [{
        wrap: ["break-word", "anywhere", "normal"]
      }],
      /**
       * Hyphens
       * @see https://tailwindcss.com/docs/hyphens
       */
      hyphens: [{
        hyphens: ["none", "manual", "auto"]
      }],
      /**
       * Content
       * @see https://tailwindcss.com/docs/content
       */
      content: [{
        content: ["none", isArbitraryVariable, isArbitraryValue]
      }],
      // -------------------
      // --- Backgrounds ---
      // -------------------
      /**
       * Background Attachment
       * @see https://tailwindcss.com/docs/background-attachment
       */
      "bg-attachment": [{
        bg: ["fixed", "local", "scroll"]
      }],
      /**
       * Background Clip
       * @see https://tailwindcss.com/docs/background-clip
       */
      "bg-clip": [{
        "bg-clip": ["border", "padding", "content", "text"]
      }],
      /**
       * Background Origin
       * @see https://tailwindcss.com/docs/background-origin
       */
      "bg-origin": [{
        "bg-origin": ["border", "padding", "content"]
      }],
      /**
       * Background Position
       * @see https://tailwindcss.com/docs/background-position
       */
      "bg-position": [{
        bg: scaleBgPosition()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: scaleBgRepeat()
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: scaleBgSize()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, isInteger, isArbitraryVariable, isArbitraryValue],
          radial: ["", isArbitraryVariable, isArbitraryValue],
          conic: [isInteger, isArbitraryVariable, isArbitraryValue]
        }, isArbitraryVariableImage, isArbitraryImage]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: scaleColor()
      }],
      /**
       * Gradient Color Stops From Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from-pos": [{
        from: scaleGradientStopPosition()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: scaleGradientStopPosition()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: scaleGradientStopPosition()
      }],
      /**
       * Gradient Color Stops From
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from": [{
        from: scaleColor()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: scaleColor()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: scaleColor()
      }],
      // ---------------
      // --- Borders ---
      // ---------------
      /**
       * Border Radius
       * @see https://tailwindcss.com/docs/border-radius
       */
      rounded: [{
        rounded: scaleRadius()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": scaleRadius()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": scaleRadius()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": scaleRadius()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": scaleRadius()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": scaleRadius()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": scaleRadius()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": scaleRadius()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": scaleRadius()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": scaleRadius()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": scaleRadius()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": scaleRadius()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": scaleRadius()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": scaleRadius()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": scaleRadius()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: scaleBorderWidth()
      }],
      /**
       * Border Width X
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": scaleBorderWidth()
      }],
      /**
       * Border Width Y
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": scaleBorderWidth()
      }],
      /**
       * Border Width Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": scaleBorderWidth()
      }],
      /**
       * Border Width End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": scaleBorderWidth()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": scaleBorderWidth()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": scaleBorderWidth()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": scaleBorderWidth()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": scaleBorderWidth()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": scaleBorderWidth()
      }],
      /**
       * Divide Width X Reverse
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x-reverse": ["divide-x-reverse"],
      /**
       * Divide Width Y
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-y": [{
        "divide-y": scaleBorderWidth()
      }],
      /**
       * Divide Width Y Reverse
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-y-reverse": ["divide-y-reverse"],
      /**
       * Border Style
       * @see https://tailwindcss.com/docs/border-style
       */
      "border-style": [{
        border: [...scaleLineStyle(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...scaleLineStyle(), "hidden", "none"]
      }],
      /**
       * Border Color
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color": [{
        border: scaleColor()
      }],
      /**
       * Border Color X
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": scaleColor()
      }],
      /**
       * Border Color Y
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": scaleColor()
      }],
      /**
       * Border Color S
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": scaleColor()
      }],
      /**
       * Border Color E
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": scaleColor()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": scaleColor()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": scaleColor()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": scaleColor()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": scaleColor()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: scaleColor()
      }],
      /**
       * Outline Style
       * @see https://tailwindcss.com/docs/outline-style
       */
      "outline-style": [{
        outline: [...scaleLineStyle(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", isNumber, isArbitraryVariableLength, isArbitraryLength]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: scaleColor()
      }],
      // ---------------
      // --- Effects ---
      // ---------------
      /**
       * Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow
       */
      shadow: [{
        shadow: [
          // Deprecated since Tailwind CSS v4.0.0
          "",
          "none",
          themeShadow,
          isArbitraryVariableShadow,
          isArbitraryShadow
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: scaleColor()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", themeInsetShadow, isArbitraryVariableShadow, isArbitraryShadow]
      }],
      /**
       * Inset Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
       */
      "inset-shadow-color": [{
        "inset-shadow": scaleColor()
      }],
      /**
       * Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
       */
      "ring-w": [{
        ring: scaleBorderWidth()
      }],
      /**
       * Ring Width Inset
       * @see https://v3.tailwindcss.com/docs/ring-width#inset-rings
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-w-inset": ["ring-inset"],
      /**
       * Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-ring-color
       */
      "ring-color": [{
        ring: scaleColor()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [isNumber, isArbitraryLength]
      }],
      /**
       * Ring Offset Color
       * @see https://v3.tailwindcss.com/docs/ring-offset-color
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-color": [{
        "ring-offset": scaleColor()
      }],
      /**
       * Inset Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
       */
      "inset-ring-w": [{
        "inset-ring": scaleBorderWidth()
      }],
      /**
       * Inset Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
       */
      "inset-ring-color": [{
        "inset-ring": scaleColor()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", themeTextShadow, isArbitraryVariableShadow, isArbitraryShadow]
      }],
      /**
       * Text Shadow Color
       * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
       */
      "text-shadow-color": [{
        "text-shadow": scaleColor()
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...scaleBlendMode(), "plus-darker", "plus-lighter"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": scaleBlendMode()
      }],
      /**
       * Mask Clip
       * @see https://tailwindcss.com/docs/mask-clip
       */
      "mask-clip": [{
        "mask-clip": ["border", "padding", "content", "fill", "stroke", "view"]
      }, "mask-no-clip"],
      /**
       * Mask Composite
       * @see https://tailwindcss.com/docs/mask-composite
       */
      "mask-composite": [{
        mask: ["add", "subtract", "intersect", "exclude"]
      }],
      /**
       * Mask Image
       * @see https://tailwindcss.com/docs/mask-image
       */
      "mask-image-linear-pos": [{
        "mask-linear": [isNumber]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": scaleMaskImagePosition()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": scaleMaskImagePosition()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": scaleColor()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": scaleColor()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": scaleMaskImagePosition()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": scaleMaskImagePosition()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": scaleColor()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": scaleColor()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": scaleMaskImagePosition()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": scaleMaskImagePosition()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": scaleColor()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": scaleColor()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": scaleMaskImagePosition()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": scaleMaskImagePosition()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": scaleColor()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": scaleColor()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": scaleMaskImagePosition()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": scaleMaskImagePosition()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": scaleColor()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": scaleColor()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": scaleMaskImagePosition()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": scaleMaskImagePosition()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": scaleColor()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": scaleColor()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": scaleMaskImagePosition()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": scaleMaskImagePosition()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": scaleColor()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": scaleColor()
      }],
      "mask-image-radial": [{
        "mask-radial": [isArbitraryVariable, isArbitraryValue]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": scaleMaskImagePosition()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": scaleMaskImagePosition()
      }],
      "mask-image-radial-from-color": [{
        "mask-radial-from": scaleColor()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": scaleColor()
      }],
      "mask-image-radial-shape": [{
        "mask-radial": ["circle", "ellipse"]
      }],
      "mask-image-radial-size": [{
        "mask-radial": [{
          closest: ["side", "corner"],
          farthest: ["side", "corner"]
        }]
      }],
      "mask-image-radial-pos": [{
        "mask-radial-at": scalePosition()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [isNumber]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": scaleMaskImagePosition()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": scaleMaskImagePosition()
      }],
      "mask-image-conic-from-color": [{
        "mask-conic-from": scaleColor()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": scaleColor()
      }],
      /**
       * Mask Mode
       * @see https://tailwindcss.com/docs/mask-mode
       */
      "mask-mode": [{
        mask: ["alpha", "luminance", "match"]
      }],
      /**
       * Mask Origin
       * @see https://tailwindcss.com/docs/mask-origin
       */
      "mask-origin": [{
        "mask-origin": ["border", "padding", "content", "fill", "stroke", "view"]
      }],
      /**
       * Mask Position
       * @see https://tailwindcss.com/docs/mask-position
       */
      "mask-position": [{
        mask: scaleBgPosition()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: scaleBgRepeat()
      }],
      /**
       * Mask Size
       * @see https://tailwindcss.com/docs/mask-size
       */
      "mask-size": [{
        mask: scaleBgSize()
      }],
      /**
       * Mask Type
       * @see https://tailwindcss.com/docs/mask-type
       */
      "mask-type": [{
        "mask-type": ["alpha", "luminance"]
      }],
      /**
       * Mask Image
       * @see https://tailwindcss.com/docs/mask-image
       */
      "mask-image": [{
        mask: ["none", isArbitraryVariable, isArbitraryValue]
      }],
      // ---------------
      // --- Filters ---
      // ---------------
      /**
       * Filter
       * @see https://tailwindcss.com/docs/filter
       */
      filter: [{
        filter: [
          // Deprecated since Tailwind CSS v3.0.0
          "",
          "none",
          isArbitraryVariable,
          isArbitraryValue
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: scaleBlur()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Drop Shadow
       * @see https://tailwindcss.com/docs/drop-shadow
       */
      "drop-shadow": [{
        "drop-shadow": [
          // Deprecated since Tailwind CSS v4.0.0
          "",
          "none",
          themeDropShadow,
          isArbitraryVariableShadow,
          isArbitraryShadow
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": scaleColor()
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: ["", isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Backdrop Filter
       * @see https://tailwindcss.com/docs/backdrop-filter
       */
      "backdrop-filter": [{
        "backdrop-filter": [
          // Deprecated since Tailwind CSS v3.0.0
          "",
          "none",
          isArbitraryVariable,
          isArbitraryValue
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": scaleBlur()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      // --------------
      // --- Tables ---
      // --------------
      /**
       * Border Collapse
       * @see https://tailwindcss.com/docs/border-collapse
       */
      "border-collapse": [{
        border: ["collapse", "separate"]
      }],
      /**
       * Border Spacing
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing": [{
        "border-spacing": scaleUnambiguousSpacing()
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": scaleUnambiguousSpacing()
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": scaleUnambiguousSpacing()
      }],
      /**
       * Table Layout
       * @see https://tailwindcss.com/docs/table-layout
       */
      "table-layout": [{
        table: ["auto", "fixed"]
      }],
      /**
       * Caption Side
       * @see https://tailwindcss.com/docs/caption-side
       */
      caption: [{
        caption: ["top", "bottom"]
      }],
      // ---------------------------------
      // --- Transitions and Animation ---
      // ---------------------------------
      /**
       * Transition Property
       * @see https://tailwindcss.com/docs/transition-property
       */
      transition: [{
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Transition Behavior
       * @see https://tailwindcss.com/docs/transition-behavior
       */
      "transition-behavior": [{
        transition: ["normal", "discrete"]
      }],
      /**
       * Transition Duration
       * @see https://tailwindcss.com/docs/transition-duration
       */
      duration: [{
        duration: [isNumber, "initial", isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", themeEase, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [isNumber, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", themeAnimate, isArbitraryVariable, isArbitraryValue]
      }],
      // ------------------
      // --- Transforms ---
      // ------------------
      /**
       * Backface Visibility
       * @see https://tailwindcss.com/docs/backface-visibility
       */
      backface: [{
        backface: ["hidden", "visible"]
      }],
      /**
       * Perspective
       * @see https://tailwindcss.com/docs/perspective
       */
      perspective: [{
        perspective: [themePerspective, isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Perspective Origin
       * @see https://tailwindcss.com/docs/perspective-origin
       */
      "perspective-origin": [{
        "perspective-origin": scalePositionWithArbitrary()
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: scaleRotate()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": scaleRotate()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": scaleRotate()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": scaleRotate()
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: scaleScale()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": scaleScale()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": scaleScale()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": scaleScale()
      }],
      /**
       * Scale 3D
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-3d": ["scale-3d"],
      /**
       * Skew
       * @see https://tailwindcss.com/docs/skew
       */
      skew: [{
        skew: scaleSkew()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": scaleSkew()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": scaleSkew()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [isArbitraryVariable, isArbitraryValue, "", "none", "gpu", "cpu"]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: scalePositionWithArbitrary()
      }],
      /**
       * Transform Style
       * @see https://tailwindcss.com/docs/transform-style
       */
      "transform-style": [{
        transform: ["3d", "flat"]
      }],
      /**
       * Translate
       * @see https://tailwindcss.com/docs/translate
       */
      translate: [{
        translate: scaleTranslate()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": scaleTranslate()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": scaleTranslate()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": scaleTranslate()
      }],
      /**
       * Translate None
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-none": ["translate-none"],
      // ---------------------
      // --- Interactivity ---
      // ---------------------
      /**
       * Accent Color
       * @see https://tailwindcss.com/docs/accent-color
       */
      accent: [{
        accent: scaleColor()
      }],
      /**
       * Appearance
       * @see https://tailwindcss.com/docs/appearance
       */
      appearance: [{
        appearance: ["none", "auto"]
      }],
      /**
       * Caret Color
       * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
       */
      "caret-color": [{
        caret: scaleColor()
      }],
      /**
       * Color Scheme
       * @see https://tailwindcss.com/docs/color-scheme
       */
      "color-scheme": [{
        scheme: ["normal", "dark", "light", "light-dark", "only-dark", "only-light"]
      }],
      /**
       * Cursor
       * @see https://tailwindcss.com/docs/cursor
       */
      cursor: [{
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", isArbitraryVariable, isArbitraryValue]
      }],
      /**
       * Field Sizing
       * @see https://tailwindcss.com/docs/field-sizing
       */
      "field-sizing": [{
        "field-sizing": ["fixed", "content"]
      }],
      /**
       * Pointer Events
       * @see https://tailwindcss.com/docs/pointer-events
       */
      "pointer-events": [{
        "pointer-events": ["auto", "none"]
      }],
      /**
       * Resize
       * @see https://tailwindcss.com/docs/resize
       */
      resize: [{
        resize: ["none", "", "y", "x"]
      }],
      /**
       * Scroll Behavior
       * @see https://tailwindcss.com/docs/scroll-behavior
       */
      "scroll-behavior": [{
        scroll: ["auto", "smooth"]
      }],
      /**
       * Scroll Margin
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-m": [{
        "scroll-m": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Margin X
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Margin Y
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Margin Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Margin End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Padding X
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Padding Y
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Padding Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Padding End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": scaleUnambiguousSpacing()
      }],
      /**
       * Scroll Snap Align
       * @see https://tailwindcss.com/docs/scroll-snap-align
       */
      "snap-align": [{
        snap: ["start", "end", "center", "align-none"]
      }],
      /**
       * Scroll Snap Stop
       * @see https://tailwindcss.com/docs/scroll-snap-stop
       */
      "snap-stop": [{
        snap: ["normal", "always"]
      }],
      /**
       * Scroll Snap Type
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-type": [{
        snap: ["none", "x", "y", "both"]
      }],
      /**
       * Scroll Snap Type Strictness
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-strictness": [{
        snap: ["mandatory", "proximity"]
      }],
      /**
       * Touch Action
       * @see https://tailwindcss.com/docs/touch-action
       */
      touch: [{
        touch: ["auto", "none", "manipulation"]
      }],
      /**
       * Touch Action X
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-x": [{
        "touch-pan": ["x", "left", "right"]
      }],
      /**
       * Touch Action Y
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-y": [{
        "touch-pan": ["y", "up", "down"]
      }],
      /**
       * Touch Action Pinch Zoom
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-pz": ["touch-pinch-zoom"],
      /**
       * User Select
       * @see https://tailwindcss.com/docs/user-select
       */
      select: [{
        select: ["none", "text", "all", "auto"]
      }],
      /**
       * Will Change
       * @see https://tailwindcss.com/docs/will-change
       */
      "will-change": [{
        "will-change": ["auto", "scroll", "contents", "transform", isArbitraryVariable, isArbitraryValue]
      }],
      // -----------
      // --- SVG ---
      // -----------
      /**
       * Fill
       * @see https://tailwindcss.com/docs/fill
       */
      fill: [{
        fill: ["none", ...scaleColor()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [isNumber, isArbitraryVariableLength, isArbitraryLength, isArbitraryNumber]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...scaleColor()]
      }],
      // ---------------------
      // --- Accessibility ---
      // ---------------------
      /**
       * Forced Color Adjust
       * @see https://tailwindcss.com/docs/forced-color-adjust
       */
      "forced-color-adjust": [{
        "forced-color-adjust": ["auto", "none"]
      }]
    },
    conflictingClassGroups: {
      overflow: ["overflow-x", "overflow-y"],
      overscroll: ["overscroll-x", "overscroll-y"],
      inset: ["inset-x", "inset-y", "start", "end", "top", "right", "bottom", "left"],
      "inset-x": ["right", "left"],
      "inset-y": ["top", "bottom"],
      flex: ["basis", "grow", "shrink"],
      gap: ["gap-x", "gap-y"],
      p: ["px", "py", "ps", "pe", "pt", "pr", "pb", "pl"],
      px: ["pr", "pl"],
      py: ["pt", "pb"],
      m: ["mx", "my", "ms", "me", "mt", "mr", "mb", "ml"],
      mx: ["mr", "ml"],
      my: ["mt", "mb"],
      size: ["w", "h"],
      "font-size": ["leading"],
      "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
      "fvn-ordinal": ["fvn-normal"],
      "fvn-slashed-zero": ["fvn-normal"],
      "fvn-figure": ["fvn-normal"],
      "fvn-spacing": ["fvn-normal"],
      "fvn-fraction": ["fvn-normal"],
      "line-clamp": ["display", "overflow"],
      rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
      "rounded-s": ["rounded-ss", "rounded-es"],
      "rounded-e": ["rounded-se", "rounded-ee"],
      "rounded-t": ["rounded-tl", "rounded-tr"],
      "rounded-r": ["rounded-tr", "rounded-br"],
      "rounded-b": ["rounded-br", "rounded-bl"],
      "rounded-l": ["rounded-tl", "rounded-bl"],
      "border-spacing": ["border-spacing-x", "border-spacing-y"],
      "border-w": ["border-w-x", "border-w-y", "border-w-s", "border-w-e", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
      "border-w-x": ["border-w-r", "border-w-l"],
      "border-w-y": ["border-w-t", "border-w-b"],
      "border-color": ["border-color-x", "border-color-y", "border-color-s", "border-color-e", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
      "border-color-x": ["border-color-r", "border-color-l"],
      "border-color-y": ["border-color-t", "border-color-b"],
      translate: ["translate-x", "translate-y", "translate-none"],
      "translate-none": ["translate", "translate-x", "translate-y", "translate-z"],
      "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
      "scroll-mx": ["scroll-mr", "scroll-ml"],
      "scroll-my": ["scroll-mt", "scroll-mb"],
      "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
      "scroll-px": ["scroll-pr", "scroll-pl"],
      "scroll-py": ["scroll-pt", "scroll-pb"],
      touch: ["touch-x", "touch-y", "touch-pz"],
      "touch-x": ["touch"],
      "touch-y": ["touch"],
      "touch-pz": ["touch"]
    },
    conflictingClassGroupModifiers: {
      "font-size": ["leading"]
    },
    orderSensitiveModifiers: ["*", "**", "after", "backdrop", "before", "details-content", "file", "first-letter", "first-line", "marker", "placeholder", "selection"]
  };
};
const twMerge = /* @__PURE__ */ createTailwindMerge(getDefaultConfig);
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline"
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10"
    }
  },
  defaultVariants: {
    variant: "default",
    size: "default"
  }
});
const Button = React.forwardRef(({ className, variant, size: size2, ...props }, ref) => {
  return jsx("button", { className: cn(buttonVariants({ variant, size: size2, className })), ref, ...props });
});
Button.displayName = "Button";
const Card = React.forwardRef(({ className, ...props }, ref) => jsx("div", { ref, className: cn("rounded-lg border bg-card text-card-foreground shadow-sm", className), ...props }));
Card.displayName = "Card";
const CardHeader = React.forwardRef(({ className, ...props }, ref) => jsx("div", { ref, className: cn("flex flex-col space-y-1.5 p-6", className), ...props }));
CardHeader.displayName = "CardHeader";
const CardTitle = React.forwardRef(({ className, ...props }, ref) => jsx("h3", { ref, className: cn("text-2xl font-semibold leading-none tracking-tight", className), ...props }));
CardTitle.displayName = "CardTitle";
const CardDescription = React.forwardRef(({ className, ...props }, ref) => jsx("p", { ref, className: cn("text-sm text-muted-foreground", className), ...props }));
CardDescription.displayName = "CardDescription";
const CardContent = React.forwardRef(({ className, ...props }, ref) => jsx("div", { ref, className: cn("p-6 pt-0", className), ...props }));
CardContent.displayName = "CardContent";
const CardFooter = React.forwardRef(({ className, ...props }, ref) => jsx("div", { ref, className: cn("flex items-center p-6 pt-0", className), ...props }));
CardFooter.displayName = "CardFooter";
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return jsx("input", { type, className: cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className), ref, ...props });
});
Input.displayName = "Input";
const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");
const Label$1 = React.forwardRef(({ className, ...props }, ref) => jsx("label", { ref, className: cn(labelVariants(), className), ...props }));
Label$1.displayName = "Label";
function setRef(ref, value) {
  if (typeof ref === "function") {
    return ref(value);
  } else if (ref !== null && ref !== void 0) {
    ref.current = value;
  }
}
function composeRefs(...refs) {
  return (node) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup == "function") {
        hasCleanup = true;
      }
      return cleanup;
    });
    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup == "function") {
            cleanup();
          } else {
            setRef(refs[i], null);
          }
        }
      };
    }
  };
}
function useComposedRefs(...refs) {
  return React.useCallback(composeRefs(...refs), refs);
}
var REACT_LAZY_TYPE = Symbol.for("react.lazy");
var use = React[" use ".trim().toString()];
function isPromiseLike(value) {
  return typeof value === "object" && value !== null && "then" in value;
}
function isLazyComponent(element) {
  return element != null && typeof element === "object" && "$$typeof" in element && element.$$typeof === REACT_LAZY_TYPE && "_payload" in element && isPromiseLike(element._payload);
}
// @__NO_SIDE_EFFECTS__
function createSlot$1(ownerName) {
  const SlotClone = /* @__PURE__ */ createSlotClone$1(ownerName);
  const Slot2 = React.forwardRef((props, forwardedRef) => {
    let { children, ...slotProps } = props;
    if (isLazyComponent(children) && typeof use === "function") {
      children = use(children._payload);
    }
    const childrenArray = React.Children.toArray(children);
    const slottable = childrenArray.find(isSlottable$1);
    if (slottable) {
      const newElement = slottable.props.children;
      const newChildren = childrenArray.map((child) => {
        if (child === slottable) {
          if (React.Children.count(newElement) > 1) return React.Children.only(null);
          return React.isValidElement(newElement) ? newElement.props.children : null;
        } else {
          return child;
        }
      });
      return /* @__PURE__ */ jsx(SlotClone, { ...slotProps, ref: forwardedRef, children: React.isValidElement(newElement) ? React.cloneElement(newElement, void 0, newChildren) : null });
    }
    return /* @__PURE__ */ jsx(SlotClone, { ...slotProps, ref: forwardedRef, children });
  });
  Slot2.displayName = `${ownerName}.Slot`;
  return Slot2;
}
// @__NO_SIDE_EFFECTS__
function createSlotClone$1(ownerName) {
  const SlotClone = React.forwardRef((props, forwardedRef) => {
    let { children, ...slotProps } = props;
    if (isLazyComponent(children) && typeof use === "function") {
      children = use(children._payload);
    }
    if (React.isValidElement(children)) {
      const childrenRef = getElementRef$2(children);
      const props2 = mergeProps$1(slotProps, children.props);
      if (children.type !== React.Fragment) {
        props2.ref = forwardedRef ? composeRefs(forwardedRef, childrenRef) : childrenRef;
      }
      return React.cloneElement(children, props2);
    }
    return React.Children.count(children) > 1 ? React.Children.only(null) : null;
  });
  SlotClone.displayName = `${ownerName}.SlotClone`;
  return SlotClone;
}
var SLOTTABLE_IDENTIFIER$1 = Symbol("radix.slottable");
function isSlottable$1(child) {
  return React.isValidElement(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER$1;
}
function mergeProps$1(slotProps, childProps) {
  const overrideProps = { ...childProps };
  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];
    const isHandler = /^on[A-Z]/.test(propName);
    if (isHandler) {
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args) => {
          const result = childPropValue(...args);
          slotPropValue(...args);
          return result;
        };
      } else if (slotPropValue) {
        overrideProps[propName] = slotPropValue;
      }
    } else if (propName === "style") {
      overrideProps[propName] = { ...slotPropValue, ...childPropValue };
    } else if (propName === "className") {
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
    }
  }
  return { ...slotProps, ...overrideProps };
}
function getElementRef$2(element) {
  var _a, _b;
  let getter = (_a = Object.getOwnPropertyDescriptor(element.props, "ref")) == null ? void 0 : _a.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.ref;
  }
  getter = (_b = Object.getOwnPropertyDescriptor(element, "ref")) == null ? void 0 : _b.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }
  return element.props.ref || element.ref;
}
var NODES$1 = [
  "a",
  "button",
  "div",
  "form",
  "h2",
  "h3",
  "img",
  "input",
  "label",
  "li",
  "nav",
  "ol",
  "p",
  "select",
  "span",
  "svg",
  "ul"
];
var Primitive$1 = NODES$1.reduce((primitive, node) => {
  const Slot2 = /* @__PURE__ */ createSlot$1(`Primitive.${node}`);
  const Node2 = React.forwardRef((props, forwardedRef) => {
    const { asChild, ...primitiveProps } = props;
    const Comp = asChild ? Slot2 : node;
    if (typeof window !== "undefined") {
      window[Symbol.for("radix-ui")] = true;
    }
    return /* @__PURE__ */ jsx(Comp, { ...primitiveProps, ref: forwardedRef });
  });
  Node2.displayName = `Primitive.${node}`;
  return { ...primitive, [node]: Node2 };
}, {});
var NAME$2 = "Separator";
var DEFAULT_ORIENTATION = "horizontal";
var ORIENTATIONS = ["horizontal", "vertical"];
var Separator$2 = React.forwardRef((props, forwardedRef) => {
  const { decorative, orientation: orientationProp = DEFAULT_ORIENTATION, ...domProps } = props;
  const orientation = isValidOrientation(orientationProp) ? orientationProp : DEFAULT_ORIENTATION;
  const ariaOrientation = orientation === "vertical" ? orientation : void 0;
  const semanticProps = decorative ? { role: "none" } : { "aria-orientation": ariaOrientation, role: "separator" };
  return /* @__PURE__ */ jsx(
    Primitive$1.div,
    {
      "data-orientation": orientation,
      ...semanticProps,
      ...domProps,
      ref: forwardedRef
    }
  );
});
Separator$2.displayName = NAME$2;
function isValidOrientation(orientation) {
  return ORIENTATIONS.includes(orientation);
}
var Root$3 = Separator$2;
const Separator$1 = React.forwardRef(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => jsx(Root$3, { ref, decorative, orientation, className: cn("shrink-0 bg-border", orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]", className), ...props }));
Separator$1.displayName = Root$3.displayName;
const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return jsx("textarea", { className: cn("flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className), ref, ...props });
});
Textarea.displayName = "Textarea";
const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
      secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
      destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
      outline: "text-foreground",
      success: "border-transparent bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
      warning: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});
function Badge({ className, variant, ...props }) {
  return jsx("div", { className: cn(badgeVariants({ variant }), className), ...props });
}
function useAuditLogFacets(client, timeRange) {
  const [verbs, setVerbs] = useState([]);
  const [resources, setResources] = useState([]);
  const [namespaces, setNamespaces] = useState([]);
  const [usernames, setUsernames] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastFetchedRef = useRef(null);
  const fetchFacets = useCallback(async () => {
    var _a;
    if (!timeRange)
      return;
    const cacheKey = `${timeRange.start}-${timeRange.end}`;
    if (lastFetchedRef.current === cacheKey && verbs.length > 0) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.queryAuditLogFacets({
        timeRange: {
          start: timeRange.start,
          end: timeRange.end
        },
        facets: [
          { field: "verb", limit: 20 },
          { field: "objectRef.resource", limit: 50 },
          { field: "objectRef.namespace", limit: 50 },
          { field: "user.username", limit: 50 }
        ]
      });
      const facets = ((_a = result.status) == null ? void 0 : _a.facets) || [];
      const verbFacet = facets.find((f) => f.field === "verb");
      setVerbs((verbFacet == null ? void 0 : verbFacet.values) || []);
      const resourceFacet = facets.find((f) => f.field === "objectRef.resource");
      setResources((resourceFacet == null ? void 0 : resourceFacet.values) || []);
      const namespaceFacet = facets.find((f) => f.field === "objectRef.namespace");
      setNamespaces((namespaceFacet == null ? void 0 : namespaceFacet.values) || []);
      const usernameFacet = facets.find((f) => f.field === "user.username");
      setUsernames((usernameFacet == null ? void 0 : usernameFacet.values) || []);
      lastFetchedRef.current = cacheKey;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, timeRange, verbs.length]);
  useEffect(() => {
    fetchFacets();
  }, [fetchFacets]);
  const refresh = useCallback(async () => {
    lastFetchedRef.current = null;
    await fetchFacets();
  }, [fetchFacets]);
  return {
    verbs,
    resources,
    namespaces,
    usernames,
    isLoading,
    error,
    refresh
  };
}
function toDate(argument) {
  const argStr = Object.prototype.toString.call(argument);
  if (argument instanceof Date || typeof argument === "object" && argStr === "[object Date]") {
    return new argument.constructor(+argument);
  } else if (typeof argument === "number" || argStr === "[object Number]" || typeof argument === "string" || argStr === "[object String]") {
    return new Date(argument);
  } else {
    return /* @__PURE__ */ new Date(NaN);
  }
}
function constructFrom(date, value) {
  if (date instanceof Date) {
    return new date.constructor(value);
  } else {
    return new Date(value);
  }
}
function addDays(date, amount) {
  const _date = toDate(date);
  if (isNaN(amount)) return constructFrom(date, NaN);
  if (!amount) {
    return _date;
  }
  _date.setDate(_date.getDate() + amount);
  return _date;
}
function addMilliseconds(date, amount) {
  const timestamp = +toDate(date);
  return constructFrom(date, timestamp + amount);
}
const millisecondsInWeek = 6048e5;
const millisecondsInDay = 864e5;
const millisecondsInMinute = 6e4;
const millisecondsInHour = 36e5;
const minutesInMonth = 43200;
const minutesInDay = 1440;
function addHours(date, amount) {
  return addMilliseconds(date, amount * millisecondsInHour);
}
let defaultOptions = {};
function getDefaultOptions() {
  return defaultOptions;
}
function startOfWeek(date, options) {
  var _a, _b, _c, _d;
  const defaultOptions2 = getDefaultOptions();
  const weekStartsOn = (options == null ? void 0 : options.weekStartsOn) ?? ((_b = (_a = options == null ? void 0 : options.locale) == null ? void 0 : _a.options) == null ? void 0 : _b.weekStartsOn) ?? defaultOptions2.weekStartsOn ?? ((_d = (_c = defaultOptions2.locale) == null ? void 0 : _c.options) == null ? void 0 : _d.weekStartsOn) ?? 0;
  const _date = toDate(date);
  const day = _date.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  _date.setDate(_date.getDate() - diff);
  _date.setHours(0, 0, 0, 0);
  return _date;
}
function startOfISOWeek(date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}
function getISOWeekYear(date) {
  const _date = toDate(date);
  const year = _date.getFullYear();
  const fourthOfJanuaryOfNextYear = constructFrom(date, 0);
  fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);
  fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfISOWeek(fourthOfJanuaryOfNextYear);
  const fourthOfJanuaryOfThisYear = constructFrom(date, 0);
  fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);
  fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfISOWeek(fourthOfJanuaryOfThisYear);
  if (_date.getTime() >= startOfNextYear.getTime()) {
    return year + 1;
  } else if (_date.getTime() >= startOfThisYear.getTime()) {
    return year;
  } else {
    return year - 1;
  }
}
function startOfDay(date) {
  const _date = toDate(date);
  _date.setHours(0, 0, 0, 0);
  return _date;
}
function getTimezoneOffsetInMilliseconds(date) {
  const _date = toDate(date);
  const utcDate = new Date(
    Date.UTC(
      _date.getFullYear(),
      _date.getMonth(),
      _date.getDate(),
      _date.getHours(),
      _date.getMinutes(),
      _date.getSeconds(),
      _date.getMilliseconds()
    )
  );
  utcDate.setUTCFullYear(_date.getFullYear());
  return +date - +utcDate;
}
function differenceInCalendarDays(dateLeft, dateRight) {
  const startOfDayLeft = startOfDay(dateLeft);
  const startOfDayRight = startOfDay(dateRight);
  const timestampLeft = +startOfDayLeft - getTimezoneOffsetInMilliseconds(startOfDayLeft);
  const timestampRight = +startOfDayRight - getTimezoneOffsetInMilliseconds(startOfDayRight);
  return Math.round((timestampLeft - timestampRight) / millisecondsInDay);
}
function startOfISOWeekYear(date) {
  const year = getISOWeekYear(date);
  const fourthOfJanuary = constructFrom(date, 0);
  fourthOfJanuary.setFullYear(year, 0, 4);
  fourthOfJanuary.setHours(0, 0, 0, 0);
  return startOfISOWeek(fourthOfJanuary);
}
function addMinutes(date, amount) {
  return addMilliseconds(date, amount * millisecondsInMinute);
}
function compareAsc(dateLeft, dateRight) {
  const _dateLeft = toDate(dateLeft);
  const _dateRight = toDate(dateRight);
  const diff = _dateLeft.getTime() - _dateRight.getTime();
  if (diff < 0) {
    return -1;
  } else if (diff > 0) {
    return 1;
  } else {
    return diff;
  }
}
function constructNow(date) {
  return constructFrom(date, Date.now());
}
function isDate(value) {
  return value instanceof Date || typeof value === "object" && Object.prototype.toString.call(value) === "[object Date]";
}
function isValid(date) {
  if (!isDate(date) && typeof date !== "number") {
    return false;
  }
  const _date = toDate(date);
  return !isNaN(Number(_date));
}
function differenceInCalendarMonths(dateLeft, dateRight) {
  const _dateLeft = toDate(dateLeft);
  const _dateRight = toDate(dateRight);
  const yearDiff = _dateLeft.getFullYear() - _dateRight.getFullYear();
  const monthDiff = _dateLeft.getMonth() - _dateRight.getMonth();
  return yearDiff * 12 + monthDiff;
}
function getRoundingMethod(method) {
  return (number) => {
    const round2 = Math.trunc;
    const result = round2(number);
    return result === 0 ? 0 : result;
  };
}
function differenceInMilliseconds(dateLeft, dateRight) {
  return +toDate(dateLeft) - +toDate(dateRight);
}
function endOfDay(date) {
  const _date = toDate(date);
  _date.setHours(23, 59, 59, 999);
  return _date;
}
function endOfMonth(date) {
  const _date = toDate(date);
  const month = _date.getMonth();
  _date.setFullYear(_date.getFullYear(), month + 1, 0);
  _date.setHours(23, 59, 59, 999);
  return _date;
}
function isLastDayOfMonth(date) {
  const _date = toDate(date);
  return +endOfDay(_date) === +endOfMonth(_date);
}
function differenceInMonths(dateLeft, dateRight) {
  const _dateLeft = toDate(dateLeft);
  const _dateRight = toDate(dateRight);
  const sign = compareAsc(_dateLeft, _dateRight);
  const difference = Math.abs(
    differenceInCalendarMonths(_dateLeft, _dateRight)
  );
  let result;
  if (difference < 1) {
    result = 0;
  } else {
    if (_dateLeft.getMonth() === 1 && _dateLeft.getDate() > 27) {
      _dateLeft.setDate(30);
    }
    _dateLeft.setMonth(_dateLeft.getMonth() - sign * difference);
    let isLastMonthNotFull = compareAsc(_dateLeft, _dateRight) === -sign;
    if (isLastDayOfMonth(toDate(dateLeft)) && difference === 1 && compareAsc(dateLeft, _dateRight) === 1) {
      isLastMonthNotFull = false;
    }
    result = sign * (difference - Number(isLastMonthNotFull));
  }
  return result === 0 ? 0 : result;
}
function differenceInSeconds(dateLeft, dateRight, options) {
  const diff = differenceInMilliseconds(dateLeft, dateRight) / 1e3;
  return getRoundingMethod()(diff);
}
function startOfYear(date) {
  const cleanDate = toDate(date);
  const _date = constructFrom(date, 0);
  _date.setFullYear(cleanDate.getFullYear(), 0, 1);
  _date.setHours(0, 0, 0, 0);
  return _date;
}
const formatDistanceLocale = {
  lessThanXSeconds: {
    one: "less than a second",
    other: "less than {{count}} seconds"
  },
  xSeconds: {
    one: "1 second",
    other: "{{count}} seconds"
  },
  halfAMinute: "half a minute",
  lessThanXMinutes: {
    one: "less than a minute",
    other: "less than {{count}} minutes"
  },
  xMinutes: {
    one: "1 minute",
    other: "{{count}} minutes"
  },
  aboutXHours: {
    one: "about 1 hour",
    other: "about {{count}} hours"
  },
  xHours: {
    one: "1 hour",
    other: "{{count}} hours"
  },
  xDays: {
    one: "1 day",
    other: "{{count}} days"
  },
  aboutXWeeks: {
    one: "about 1 week",
    other: "about {{count}} weeks"
  },
  xWeeks: {
    one: "1 week",
    other: "{{count}} weeks"
  },
  aboutXMonths: {
    one: "about 1 month",
    other: "about {{count}} months"
  },
  xMonths: {
    one: "1 month",
    other: "{{count}} months"
  },
  aboutXYears: {
    one: "about 1 year",
    other: "about {{count}} years"
  },
  xYears: {
    one: "1 year",
    other: "{{count}} years"
  },
  overXYears: {
    one: "over 1 year",
    other: "over {{count}} years"
  },
  almostXYears: {
    one: "almost 1 year",
    other: "almost {{count}} years"
  }
};
const formatDistance$1 = (token, count2, options) => {
  let result;
  const tokenValue = formatDistanceLocale[token];
  if (typeof tokenValue === "string") {
    result = tokenValue;
  } else if (count2 === 1) {
    result = tokenValue.one;
  } else {
    result = tokenValue.other.replace("{{count}}", count2.toString());
  }
  if (options == null ? void 0 : options.addSuffix) {
    if (options.comparison && options.comparison > 0) {
      return "in " + result;
    } else {
      return result + " ago";
    }
  }
  return result;
};
function buildFormatLongFn(args) {
  return (options = {}) => {
    const width = options.width ? String(options.width) : args.defaultWidth;
    const format2 = args.formats[width] || args.formats[args.defaultWidth];
    return format2;
  };
}
const dateFormats = {
  full: "EEEE, MMMM do, y",
  long: "MMMM do, y",
  medium: "MMM d, y",
  short: "MM/dd/yyyy"
};
const timeFormats = {
  full: "h:mm:ss a zzzz",
  long: "h:mm:ss a z",
  medium: "h:mm:ss a",
  short: "h:mm a"
};
const dateTimeFormats = {
  full: "{{date}} 'at' {{time}}",
  long: "{{date}} 'at' {{time}}",
  medium: "{{date}}, {{time}}",
  short: "{{date}}, {{time}}"
};
const formatLong = {
  date: buildFormatLongFn({
    formats: dateFormats,
    defaultWidth: "full"
  }),
  time: buildFormatLongFn({
    formats: timeFormats,
    defaultWidth: "full"
  }),
  dateTime: buildFormatLongFn({
    formats: dateTimeFormats,
    defaultWidth: "full"
  })
};
const formatRelativeLocale = {
  lastWeek: "'last' eeee 'at' p",
  yesterday: "'yesterday at' p",
  today: "'today at' p",
  tomorrow: "'tomorrow at' p",
  nextWeek: "eeee 'at' p",
  other: "P"
};
const formatRelative = (token, _date, _baseDate, _options) => formatRelativeLocale[token];
function buildLocalizeFn(args) {
  return (value, options) => {
    const context = (options == null ? void 0 : options.context) ? String(options.context) : "standalone";
    let valuesArray;
    if (context === "formatting" && args.formattingValues) {
      const defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
      const width = (options == null ? void 0 : options.width) ? String(options.width) : defaultWidth;
      valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
    } else {
      const defaultWidth = args.defaultWidth;
      const width = (options == null ? void 0 : options.width) ? String(options.width) : args.defaultWidth;
      valuesArray = args.values[width] || args.values[defaultWidth];
    }
    const index2 = args.argumentCallback ? args.argumentCallback(value) : value;
    return valuesArray[index2];
  };
}
const eraValues = {
  narrow: ["B", "A"],
  abbreviated: ["BC", "AD"],
  wide: ["Before Christ", "Anno Domini"]
};
const quarterValues = {
  narrow: ["1", "2", "3", "4"],
  abbreviated: ["Q1", "Q2", "Q3", "Q4"],
  wide: ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"]
};
const monthValues = {
  narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
  abbreviated: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ],
  wide: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ]
};
const dayValues = {
  narrow: ["S", "M", "T", "W", "T", "F", "S"],
  short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  abbreviated: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  wide: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ]
};
const dayPeriodValues = {
  narrow: {
    am: "a",
    pm: "p",
    midnight: "mi",
    noon: "n",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  },
  abbreviated: {
    am: "AM",
    pm: "PM",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  },
  wide: {
    am: "a.m.",
    pm: "p.m.",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  }
};
const formattingDayPeriodValues = {
  narrow: {
    am: "a",
    pm: "p",
    midnight: "mi",
    noon: "n",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  },
  abbreviated: {
    am: "AM",
    pm: "PM",
    midnight: "midnight",
    noon: "noon",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  },
  wide: {
    am: "a.m.",
    pm: "p.m.",
    midnight: "midnight",
    noon: "noon",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  }
};
const ordinalNumber = (dirtyNumber, _options) => {
  const number = Number(dirtyNumber);
  const rem100 = number % 100;
  if (rem100 > 20 || rem100 < 10) {
    switch (rem100 % 10) {
      case 1:
        return number + "st";
      case 2:
        return number + "nd";
      case 3:
        return number + "rd";
    }
  }
  return number + "th";
};
const localize = {
  ordinalNumber,
  era: buildLocalizeFn({
    values: eraValues,
    defaultWidth: "wide"
  }),
  quarter: buildLocalizeFn({
    values: quarterValues,
    defaultWidth: "wide",
    argumentCallback: (quarter) => quarter - 1
  }),
  month: buildLocalizeFn({
    values: monthValues,
    defaultWidth: "wide"
  }),
  day: buildLocalizeFn({
    values: dayValues,
    defaultWidth: "wide"
  }),
  dayPeriod: buildLocalizeFn({
    values: dayPeriodValues,
    defaultWidth: "wide",
    formattingValues: formattingDayPeriodValues,
    defaultFormattingWidth: "wide"
  })
};
function buildMatchFn(args) {
  return (string, options = {}) => {
    const width = options.width;
    const matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
    const matchResult = string.match(matchPattern);
    if (!matchResult) {
      return null;
    }
    const matchedString = matchResult[0];
    const parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
    const key = Array.isArray(parsePatterns) ? findIndex(parsePatterns, (pattern) => pattern.test(matchedString)) : (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- I challange you to fix the type
      findKey(parsePatterns, (pattern) => pattern.test(matchedString))
    );
    let value;
    value = args.valueCallback ? args.valueCallback(key) : key;
    value = options.valueCallback ? (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- I challange you to fix the type
      options.valueCallback(value)
    ) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}
function findKey(object, predicate) {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key) && predicate(object[key])) {
      return key;
    }
  }
  return void 0;
}
function findIndex(array, predicate) {
  for (let key = 0; key < array.length; key++) {
    if (predicate(array[key])) {
      return key;
    }
  }
  return void 0;
}
function buildMatchPatternFn(args) {
  return (string, options = {}) => {
    const matchResult = string.match(args.matchPattern);
    if (!matchResult) return null;
    const matchedString = matchResult[0];
    const parseResult = string.match(args.parsePattern);
    if (!parseResult) return null;
    let value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
    value = options.valueCallback ? options.valueCallback(value) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}
const matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
const parseOrdinalNumberPattern = /\d+/i;
const matchEraPatterns = {
  narrow: /^(b|a)/i,
  abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
  wide: /^(before christ|before common era|anno domini|common era)/i
};
const parseEraPatterns = {
  any: [/^b/i, /^(a|c)/i]
};
const matchQuarterPatterns = {
  narrow: /^[1234]/i,
  abbreviated: /^q[1234]/i,
  wide: /^[1234](th|st|nd|rd)? quarter/i
};
const parseQuarterPatterns = {
  any: [/1/i, /2/i, /3/i, /4/i]
};
const matchMonthPatterns = {
  narrow: /^[jfmasond]/i,
  abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
};
const parseMonthPatterns = {
  narrow: [
    /^j/i,
    /^f/i,
    /^m/i,
    /^a/i,
    /^m/i,
    /^j/i,
    /^j/i,
    /^a/i,
    /^s/i,
    /^o/i,
    /^n/i,
    /^d/i
  ],
  any: [
    /^ja/i,
    /^f/i,
    /^mar/i,
    /^ap/i,
    /^may/i,
    /^jun/i,
    /^jul/i,
    /^au/i,
    /^s/i,
    /^o/i,
    /^n/i,
    /^d/i
  ]
};
const matchDayPatterns = {
  narrow: /^[smtwf]/i,
  short: /^(su|mo|tu|we|th|fr|sa)/i,
  abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
  wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
};
const parseDayPatterns = {
  narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
  any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
};
const matchDayPeriodPatterns = {
  narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
  any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
};
const parseDayPeriodPatterns = {
  any: {
    am: /^a/i,
    pm: /^p/i,
    midnight: /^mi/i,
    noon: /^no/i,
    morning: /morning/i,
    afternoon: /afternoon/i,
    evening: /evening/i,
    night: /night/i
  }
};
const match = {
  ordinalNumber: buildMatchPatternFn({
    matchPattern: matchOrdinalNumberPattern,
    parsePattern: parseOrdinalNumberPattern,
    valueCallback: (value) => parseInt(value, 10)
  }),
  era: buildMatchFn({
    matchPatterns: matchEraPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseEraPatterns,
    defaultParseWidth: "any"
  }),
  quarter: buildMatchFn({
    matchPatterns: matchQuarterPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseQuarterPatterns,
    defaultParseWidth: "any",
    valueCallback: (index2) => index2 + 1
  }),
  month: buildMatchFn({
    matchPatterns: matchMonthPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseMonthPatterns,
    defaultParseWidth: "any"
  }),
  day: buildMatchFn({
    matchPatterns: matchDayPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseDayPatterns,
    defaultParseWidth: "any"
  }),
  dayPeriod: buildMatchFn({
    matchPatterns: matchDayPeriodPatterns,
    defaultMatchWidth: "any",
    parsePatterns: parseDayPeriodPatterns,
    defaultParseWidth: "any"
  })
};
const enUS = {
  code: "en-US",
  formatDistance: formatDistance$1,
  formatLong,
  formatRelative,
  localize,
  match,
  options: {
    weekStartsOn: 0,
    firstWeekContainsDate: 1
  }
};
function getDayOfYear(date) {
  const _date = toDate(date);
  const diff = differenceInCalendarDays(_date, startOfYear(_date));
  const dayOfYear = diff + 1;
  return dayOfYear;
}
function getISOWeek(date) {
  const _date = toDate(date);
  const diff = +startOfISOWeek(_date) - +startOfISOWeekYear(_date);
  return Math.round(diff / millisecondsInWeek) + 1;
}
function getWeekYear(date, options) {
  var _a, _b, _c, _d;
  const _date = toDate(date);
  const year = _date.getFullYear();
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = (options == null ? void 0 : options.firstWeekContainsDate) ?? ((_b = (_a = options == null ? void 0 : options.locale) == null ? void 0 : _a.options) == null ? void 0 : _b.firstWeekContainsDate) ?? defaultOptions2.firstWeekContainsDate ?? ((_d = (_c = defaultOptions2.locale) == null ? void 0 : _c.options) == null ? void 0 : _d.firstWeekContainsDate) ?? 1;
  const firstWeekOfNextYear = constructFrom(date, 0);
  firstWeekOfNextYear.setFullYear(year + 1, 0, firstWeekContainsDate);
  firstWeekOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfWeek(firstWeekOfNextYear, options);
  const firstWeekOfThisYear = constructFrom(date, 0);
  firstWeekOfThisYear.setFullYear(year, 0, firstWeekContainsDate);
  firstWeekOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfWeek(firstWeekOfThisYear, options);
  if (_date.getTime() >= startOfNextYear.getTime()) {
    return year + 1;
  } else if (_date.getTime() >= startOfThisYear.getTime()) {
    return year;
  } else {
    return year - 1;
  }
}
function startOfWeekYear(date, options) {
  var _a, _b, _c, _d;
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = (options == null ? void 0 : options.firstWeekContainsDate) ?? ((_b = (_a = options == null ? void 0 : options.locale) == null ? void 0 : _a.options) == null ? void 0 : _b.firstWeekContainsDate) ?? defaultOptions2.firstWeekContainsDate ?? ((_d = (_c = defaultOptions2.locale) == null ? void 0 : _c.options) == null ? void 0 : _d.firstWeekContainsDate) ?? 1;
  const year = getWeekYear(date, options);
  const firstWeek = constructFrom(date, 0);
  firstWeek.setFullYear(year, 0, firstWeekContainsDate);
  firstWeek.setHours(0, 0, 0, 0);
  const _date = startOfWeek(firstWeek, options);
  return _date;
}
function getWeek(date, options) {
  const _date = toDate(date);
  const diff = +startOfWeek(_date, options) - +startOfWeekYear(_date, options);
  return Math.round(diff / millisecondsInWeek) + 1;
}
function addLeadingZeros(number, targetLength) {
  const sign = number < 0 ? "-" : "";
  const output = Math.abs(number).toString().padStart(targetLength, "0");
  return sign + output;
}
const lightFormatters = {
  // Year
  y(date, token) {
    const signedYear = date.getFullYear();
    const year = signedYear > 0 ? signedYear : 1 - signedYear;
    return addLeadingZeros(token === "yy" ? year % 100 : year, token.length);
  },
  // Month
  M(date, token) {
    const month = date.getMonth();
    return token === "M" ? String(month + 1) : addLeadingZeros(month + 1, 2);
  },
  // Day of the month
  d(date, token) {
    return addLeadingZeros(date.getDate(), token.length);
  },
  // AM or PM
  a(date, token) {
    const dayPeriodEnumValue = date.getHours() / 12 >= 1 ? "pm" : "am";
    switch (token) {
      case "a":
      case "aa":
        return dayPeriodEnumValue.toUpperCase();
      case "aaa":
        return dayPeriodEnumValue;
      case "aaaaa":
        return dayPeriodEnumValue[0];
      case "aaaa":
      default:
        return dayPeriodEnumValue === "am" ? "a.m." : "p.m.";
    }
  },
  // Hour [1-12]
  h(date, token) {
    return addLeadingZeros(date.getHours() % 12 || 12, token.length);
  },
  // Hour [0-23]
  H(date, token) {
    return addLeadingZeros(date.getHours(), token.length);
  },
  // Minute
  m(date, token) {
    return addLeadingZeros(date.getMinutes(), token.length);
  },
  // Second
  s(date, token) {
    return addLeadingZeros(date.getSeconds(), token.length);
  },
  // Fraction of second
  S(date, token) {
    const numberOfDigits = token.length;
    const milliseconds = date.getMilliseconds();
    const fractionalSeconds = Math.trunc(
      milliseconds * Math.pow(10, numberOfDigits - 3)
    );
    return addLeadingZeros(fractionalSeconds, token.length);
  }
};
const dayPeriodEnum = {
  midnight: "midnight",
  noon: "noon",
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  night: "night"
};
const formatters = {
  // Era
  G: function(date, token, localize2) {
    const era = date.getFullYear() > 0 ? 1 : 0;
    switch (token) {
      case "G":
      case "GG":
      case "GGG":
        return localize2.era(era, { width: "abbreviated" });
      case "GGGGG":
        return localize2.era(era, { width: "narrow" });
      case "GGGG":
      default:
        return localize2.era(era, { width: "wide" });
    }
  },
  // Year
  y: function(date, token, localize2) {
    if (token === "yo") {
      const signedYear = date.getFullYear();
      const year = signedYear > 0 ? signedYear : 1 - signedYear;
      return localize2.ordinalNumber(year, { unit: "year" });
    }
    return lightFormatters.y(date, token);
  },
  // Local week-numbering year
  Y: function(date, token, localize2, options) {
    const signedWeekYear = getWeekYear(date, options);
    const weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear;
    if (token === "YY") {
      const twoDigitYear = weekYear % 100;
      return addLeadingZeros(twoDigitYear, 2);
    }
    if (token === "Yo") {
      return localize2.ordinalNumber(weekYear, { unit: "year" });
    }
    return addLeadingZeros(weekYear, token.length);
  },
  // ISO week-numbering year
  R: function(date, token) {
    const isoWeekYear = getISOWeekYear(date);
    return addLeadingZeros(isoWeekYear, token.length);
  },
  // Extended year. This is a single number designating the year of this calendar system.
  // The main difference between `y` and `u` localizers are B.C. years:
  // | Year | `y` | `u` |
  // |------|-----|-----|
  // | AC 1 |   1 |   1 |
  // | BC 1 |   1 |   0 |
  // | BC 2 |   2 |  -1 |
  // Also `yy` always returns the last two digits of a year,
  // while `uu` pads single digit years to 2 characters and returns other years unchanged.
  u: function(date, token) {
    const year = date.getFullYear();
    return addLeadingZeros(year, token.length);
  },
  // Quarter
  Q: function(date, token, localize2) {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    switch (token) {
      case "Q":
        return String(quarter);
      case "QQ":
        return addLeadingZeros(quarter, 2);
      case "Qo":
        return localize2.ordinalNumber(quarter, { unit: "quarter" });
      case "QQQ":
        return localize2.quarter(quarter, {
          width: "abbreviated",
          context: "formatting"
        });
      case "QQQQQ":
        return localize2.quarter(quarter, {
          width: "narrow",
          context: "formatting"
        });
      case "QQQQ":
      default:
        return localize2.quarter(quarter, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Stand-alone quarter
  q: function(date, token, localize2) {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    switch (token) {
      case "q":
        return String(quarter);
      case "qq":
        return addLeadingZeros(quarter, 2);
      case "qo":
        return localize2.ordinalNumber(quarter, { unit: "quarter" });
      case "qqq":
        return localize2.quarter(quarter, {
          width: "abbreviated",
          context: "standalone"
        });
      case "qqqqq":
        return localize2.quarter(quarter, {
          width: "narrow",
          context: "standalone"
        });
      case "qqqq":
      default:
        return localize2.quarter(quarter, {
          width: "wide",
          context: "standalone"
        });
    }
  },
  // Month
  M: function(date, token, localize2) {
    const month = date.getMonth();
    switch (token) {
      case "M":
      case "MM":
        return lightFormatters.M(date, token);
      case "Mo":
        return localize2.ordinalNumber(month + 1, { unit: "month" });
      case "MMM":
        return localize2.month(month, {
          width: "abbreviated",
          context: "formatting"
        });
      case "MMMMM":
        return localize2.month(month, {
          width: "narrow",
          context: "formatting"
        });
      case "MMMM":
      default:
        return localize2.month(month, { width: "wide", context: "formatting" });
    }
  },
  // Stand-alone month
  L: function(date, token, localize2) {
    const month = date.getMonth();
    switch (token) {
      case "L":
        return String(month + 1);
      case "LL":
        return addLeadingZeros(month + 1, 2);
      case "Lo":
        return localize2.ordinalNumber(month + 1, { unit: "month" });
      case "LLL":
        return localize2.month(month, {
          width: "abbreviated",
          context: "standalone"
        });
      case "LLLLL":
        return localize2.month(month, {
          width: "narrow",
          context: "standalone"
        });
      case "LLLL":
      default:
        return localize2.month(month, { width: "wide", context: "standalone" });
    }
  },
  // Local week of year
  w: function(date, token, localize2, options) {
    const week = getWeek(date, options);
    if (token === "wo") {
      return localize2.ordinalNumber(week, { unit: "week" });
    }
    return addLeadingZeros(week, token.length);
  },
  // ISO week of year
  I: function(date, token, localize2) {
    const isoWeek = getISOWeek(date);
    if (token === "Io") {
      return localize2.ordinalNumber(isoWeek, { unit: "week" });
    }
    return addLeadingZeros(isoWeek, token.length);
  },
  // Day of the month
  d: function(date, token, localize2) {
    if (token === "do") {
      return localize2.ordinalNumber(date.getDate(), { unit: "date" });
    }
    return lightFormatters.d(date, token);
  },
  // Day of year
  D: function(date, token, localize2) {
    const dayOfYear = getDayOfYear(date);
    if (token === "Do") {
      return localize2.ordinalNumber(dayOfYear, { unit: "dayOfYear" });
    }
    return addLeadingZeros(dayOfYear, token.length);
  },
  // Day of week
  E: function(date, token, localize2) {
    const dayOfWeek = date.getDay();
    switch (token) {
      case "E":
      case "EE":
      case "EEE":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      case "EEEEE":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      case "EEEEEE":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      case "EEEE":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Local day of week
  e: function(date, token, localize2, options) {
    const dayOfWeek = date.getDay();
    const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
    switch (token) {
      case "e":
        return String(localDayOfWeek);
      case "ee":
        return addLeadingZeros(localDayOfWeek, 2);
      case "eo":
        return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
      case "eee":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      case "eeeee":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      case "eeeeee":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      case "eeee":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Stand-alone local day of week
  c: function(date, token, localize2, options) {
    const dayOfWeek = date.getDay();
    const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
    switch (token) {
      case "c":
        return String(localDayOfWeek);
      case "cc":
        return addLeadingZeros(localDayOfWeek, token.length);
      case "co":
        return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
      case "ccc":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "standalone"
        });
      case "ccccc":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "standalone"
        });
      case "cccccc":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "standalone"
        });
      case "cccc":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "standalone"
        });
    }
  },
  // ISO day of week
  i: function(date, token, localize2) {
    const dayOfWeek = date.getDay();
    const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    switch (token) {
      case "i":
        return String(isoDayOfWeek);
      case "ii":
        return addLeadingZeros(isoDayOfWeek, token.length);
      case "io":
        return localize2.ordinalNumber(isoDayOfWeek, { unit: "day" });
      case "iii":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      case "iiiii":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      case "iiiiii":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      case "iiii":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // AM or PM
  a: function(date, token, localize2) {
    const hours = date.getHours();
    const dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
    switch (token) {
      case "a":
      case "aa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "aaa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        }).toLowerCase();
      case "aaaaa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "aaaa":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // AM, PM, midnight, noon
  b: function(date, token, localize2) {
    const hours = date.getHours();
    let dayPeriodEnumValue;
    if (hours === 12) {
      dayPeriodEnumValue = dayPeriodEnum.noon;
    } else if (hours === 0) {
      dayPeriodEnumValue = dayPeriodEnum.midnight;
    } else {
      dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
    }
    switch (token) {
      case "b":
      case "bb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "bbb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        }).toLowerCase();
      case "bbbbb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "bbbb":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // in the morning, in the afternoon, in the evening, at night
  B: function(date, token, localize2) {
    const hours = date.getHours();
    let dayPeriodEnumValue;
    if (hours >= 17) {
      dayPeriodEnumValue = dayPeriodEnum.evening;
    } else if (hours >= 12) {
      dayPeriodEnumValue = dayPeriodEnum.afternoon;
    } else if (hours >= 4) {
      dayPeriodEnumValue = dayPeriodEnum.morning;
    } else {
      dayPeriodEnumValue = dayPeriodEnum.night;
    }
    switch (token) {
      case "B":
      case "BB":
      case "BBB":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "BBBBB":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "BBBB":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Hour [1-12]
  h: function(date, token, localize2) {
    if (token === "ho") {
      let hours = date.getHours() % 12;
      if (hours === 0) hours = 12;
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return lightFormatters.h(date, token);
  },
  // Hour [0-23]
  H: function(date, token, localize2) {
    if (token === "Ho") {
      return localize2.ordinalNumber(date.getHours(), { unit: "hour" });
    }
    return lightFormatters.H(date, token);
  },
  // Hour [0-11]
  K: function(date, token, localize2) {
    const hours = date.getHours() % 12;
    if (token === "Ko") {
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return addLeadingZeros(hours, token.length);
  },
  // Hour [1-24]
  k: function(date, token, localize2) {
    let hours = date.getHours();
    if (hours === 0) hours = 24;
    if (token === "ko") {
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return addLeadingZeros(hours, token.length);
  },
  // Minute
  m: function(date, token, localize2) {
    if (token === "mo") {
      return localize2.ordinalNumber(date.getMinutes(), { unit: "minute" });
    }
    return lightFormatters.m(date, token);
  },
  // Second
  s: function(date, token, localize2) {
    if (token === "so") {
      return localize2.ordinalNumber(date.getSeconds(), { unit: "second" });
    }
    return lightFormatters.s(date, token);
  },
  // Fraction of second
  S: function(date, token) {
    return lightFormatters.S(date, token);
  },
  // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
  X: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    if (timezoneOffset === 0) {
      return "Z";
    }
    switch (token) {
      case "X":
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      case "XXXX":
      case "XX":
        return formatTimezone(timezoneOffset);
      case "XXXXX":
      case "XXX":
      default:
        return formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
  x: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      case "x":
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      case "xxxx":
      case "xx":
        return formatTimezone(timezoneOffset);
      case "xxxxx":
      case "xxx":
      default:
        return formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (GMT)
  O: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      case "O":
      case "OO":
      case "OOO":
        return "GMT" + formatTimezoneShort(timezoneOffset, ":");
      case "OOOO":
      default:
        return "GMT" + formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (specific non-location)
  z: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      case "z":
      case "zz":
      case "zzz":
        return "GMT" + formatTimezoneShort(timezoneOffset, ":");
      case "zzzz":
      default:
        return "GMT" + formatTimezone(timezoneOffset, ":");
    }
  },
  // Seconds timestamp
  t: function(date, token, _localize) {
    const timestamp = Math.trunc(date.getTime() / 1e3);
    return addLeadingZeros(timestamp, token.length);
  },
  // Milliseconds timestamp
  T: function(date, token, _localize) {
    const timestamp = date.getTime();
    return addLeadingZeros(timestamp, token.length);
  }
};
function formatTimezoneShort(offset2, delimiter = "") {
  const sign = offset2 > 0 ? "-" : "+";
  const absOffset = Math.abs(offset2);
  const hours = Math.trunc(absOffset / 60);
  const minutes = absOffset % 60;
  if (minutes === 0) {
    return sign + String(hours);
  }
  return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
}
function formatTimezoneWithOptionalMinutes(offset2, delimiter) {
  if (offset2 % 60 === 0) {
    const sign = offset2 > 0 ? "-" : "+";
    return sign + addLeadingZeros(Math.abs(offset2) / 60, 2);
  }
  return formatTimezone(offset2, delimiter);
}
function formatTimezone(offset2, delimiter = "") {
  const sign = offset2 > 0 ? "-" : "+";
  const absOffset = Math.abs(offset2);
  const hours = addLeadingZeros(Math.trunc(absOffset / 60), 2);
  const minutes = addLeadingZeros(absOffset % 60, 2);
  return sign + hours + delimiter + minutes;
}
const dateLongFormatter = (pattern, formatLong2) => {
  switch (pattern) {
    case "P":
      return formatLong2.date({ width: "short" });
    case "PP":
      return formatLong2.date({ width: "medium" });
    case "PPP":
      return formatLong2.date({ width: "long" });
    case "PPPP":
    default:
      return formatLong2.date({ width: "full" });
  }
};
const timeLongFormatter = (pattern, formatLong2) => {
  switch (pattern) {
    case "p":
      return formatLong2.time({ width: "short" });
    case "pp":
      return formatLong2.time({ width: "medium" });
    case "ppp":
      return formatLong2.time({ width: "long" });
    case "pppp":
    default:
      return formatLong2.time({ width: "full" });
  }
};
const dateTimeLongFormatter = (pattern, formatLong2) => {
  const matchResult = pattern.match(/(P+)(p+)?/) || [];
  const datePattern = matchResult[1];
  const timePattern = matchResult[2];
  if (!timePattern) {
    return dateLongFormatter(pattern, formatLong2);
  }
  let dateTimeFormat;
  switch (datePattern) {
    case "P":
      dateTimeFormat = formatLong2.dateTime({ width: "short" });
      break;
    case "PP":
      dateTimeFormat = formatLong2.dateTime({ width: "medium" });
      break;
    case "PPP":
      dateTimeFormat = formatLong2.dateTime({ width: "long" });
      break;
    case "PPPP":
    default:
      dateTimeFormat = formatLong2.dateTime({ width: "full" });
      break;
  }
  return dateTimeFormat.replace("{{date}}", dateLongFormatter(datePattern, formatLong2)).replace("{{time}}", timeLongFormatter(timePattern, formatLong2));
};
const longFormatters = {
  p: timeLongFormatter,
  P: dateTimeLongFormatter
};
const dayOfYearTokenRE = /^D+$/;
const weekYearTokenRE = /^Y+$/;
const throwTokens = ["D", "DD", "YY", "YYYY"];
function isProtectedDayOfYearToken(token) {
  return dayOfYearTokenRE.test(token);
}
function isProtectedWeekYearToken(token) {
  return weekYearTokenRE.test(token);
}
function warnOrThrowProtectedError(token, format2, input) {
  const _message = message(token, format2, input);
  console.warn(_message);
  if (throwTokens.includes(token)) throw new RangeError(_message);
}
function message(token, format2, input) {
  const subject = token[0] === "Y" ? "years" : "days of the month";
  return `Use \`${token.toLowerCase()}\` instead of \`${token}\` (in \`${format2}\`) for formatting ${subject} to the input \`${input}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`;
}
const formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g;
const longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
const escapedStringRegExp = /^'([^]*?)'?$/;
const doubleQuoteRegExp = /''/g;
const unescapedLatinCharacterRegExp = /[a-zA-Z]/;
function format(date, formatStr, options) {
  var _a, _b, _c, _d;
  const defaultOptions2 = getDefaultOptions();
  const locale = defaultOptions2.locale ?? enUS;
  const firstWeekContainsDate = defaultOptions2.firstWeekContainsDate ?? ((_b = (_a = defaultOptions2.locale) == null ? void 0 : _a.options) == null ? void 0 : _b.firstWeekContainsDate) ?? 1;
  const weekStartsOn = defaultOptions2.weekStartsOn ?? ((_d = (_c = defaultOptions2.locale) == null ? void 0 : _c.options) == null ? void 0 : _d.weekStartsOn) ?? 0;
  const originalDate = toDate(date);
  if (!isValid(originalDate)) {
    throw new RangeError("Invalid time value");
  }
  let parts = formatStr.match(longFormattingTokensRegExp).map((substring) => {
    const firstCharacter = substring[0];
    if (firstCharacter === "p" || firstCharacter === "P") {
      const longFormatter = longFormatters[firstCharacter];
      return longFormatter(substring, locale.formatLong);
    }
    return substring;
  }).join("").match(formattingTokensRegExp).map((substring) => {
    if (substring === "''") {
      return { isToken: false, value: "'" };
    }
    const firstCharacter = substring[0];
    if (firstCharacter === "'") {
      return { isToken: false, value: cleanEscapedString(substring) };
    }
    if (formatters[firstCharacter]) {
      return { isToken: true, value: substring };
    }
    if (firstCharacter.match(unescapedLatinCharacterRegExp)) {
      throw new RangeError(
        "Format string contains an unescaped latin alphabet character `" + firstCharacter + "`"
      );
    }
    return { isToken: false, value: substring };
  });
  if (locale.localize.preprocessor) {
    parts = locale.localize.preprocessor(originalDate, parts);
  }
  const formatterOptions = {
    firstWeekContainsDate,
    weekStartsOn,
    locale
  };
  return parts.map((part) => {
    if (!part.isToken) return part.value;
    const token = part.value;
    if (isProtectedWeekYearToken(token) || isProtectedDayOfYearToken(token)) {
      warnOrThrowProtectedError(token, formatStr, String(date));
    }
    const formatter = formatters[token[0]];
    return formatter(originalDate, token, locale.localize, formatterOptions);
  }).join("");
}
function cleanEscapedString(input) {
  const matched = input.match(escapedStringRegExp);
  if (!matched) {
    return input;
  }
  return matched[1].replace(doubleQuoteRegExp, "'");
}
function formatDistance(date, baseDate, options) {
  const defaultOptions2 = getDefaultOptions();
  const locale = (options == null ? void 0 : options.locale) ?? defaultOptions2.locale ?? enUS;
  const minutesInAlmostTwoDays = 2520;
  const comparison = compareAsc(date, baseDate);
  if (isNaN(comparison)) {
    throw new RangeError("Invalid time value");
  }
  const localizeOptions = Object.assign({}, options, {
    addSuffix: options == null ? void 0 : options.addSuffix,
    comparison
  });
  let dateLeft;
  let dateRight;
  if (comparison > 0) {
    dateLeft = toDate(baseDate);
    dateRight = toDate(date);
  } else {
    dateLeft = toDate(date);
    dateRight = toDate(baseDate);
  }
  const seconds = differenceInSeconds(dateRight, dateLeft);
  const offsetInSeconds = (getTimezoneOffsetInMilliseconds(dateRight) - getTimezoneOffsetInMilliseconds(dateLeft)) / 1e3;
  const minutes = Math.round((seconds - offsetInSeconds) / 60);
  let months;
  if (minutes < 2) {
    if (options == null ? void 0 : options.includeSeconds) {
      if (seconds < 5) {
        return locale.formatDistance("lessThanXSeconds", 5, localizeOptions);
      } else if (seconds < 10) {
        return locale.formatDistance("lessThanXSeconds", 10, localizeOptions);
      } else if (seconds < 20) {
        return locale.formatDistance("lessThanXSeconds", 20, localizeOptions);
      } else if (seconds < 40) {
        return locale.formatDistance("halfAMinute", 0, localizeOptions);
      } else if (seconds < 60) {
        return locale.formatDistance("lessThanXMinutes", 1, localizeOptions);
      } else {
        return locale.formatDistance("xMinutes", 1, localizeOptions);
      }
    } else {
      if (minutes === 0) {
        return locale.formatDistance("lessThanXMinutes", 1, localizeOptions);
      } else {
        return locale.formatDistance("xMinutes", minutes, localizeOptions);
      }
    }
  } else if (minutes < 45) {
    return locale.formatDistance("xMinutes", minutes, localizeOptions);
  } else if (minutes < 90) {
    return locale.formatDistance("aboutXHours", 1, localizeOptions);
  } else if (minutes < minutesInDay) {
    const hours = Math.round(minutes / 60);
    return locale.formatDistance("aboutXHours", hours, localizeOptions);
  } else if (minutes < minutesInAlmostTwoDays) {
    return locale.formatDistance("xDays", 1, localizeOptions);
  } else if (minutes < minutesInMonth) {
    const days = Math.round(minutes / minutesInDay);
    return locale.formatDistance("xDays", days, localizeOptions);
  } else if (minutes < minutesInMonth * 2) {
    months = Math.round(minutes / minutesInMonth);
    return locale.formatDistance("aboutXMonths", months, localizeOptions);
  }
  months = differenceInMonths(dateRight, dateLeft);
  if (months < 12) {
    const nearestMonth = Math.round(minutes / minutesInMonth);
    return locale.formatDistance("xMonths", nearestMonth, localizeOptions);
  } else {
    const monthsSinceStartOfYear = months % 12;
    const years = Math.trunc(months / 12);
    if (monthsSinceStartOfYear < 3) {
      return locale.formatDistance("aboutXYears", years, localizeOptions);
    } else if (monthsSinceStartOfYear < 9) {
      return locale.formatDistance("overXYears", years, localizeOptions);
    } else {
      return locale.formatDistance("almostXYears", years + 1, localizeOptions);
    }
  }
}
function formatDistanceToNow(date, options) {
  return formatDistance(date, constructNow(date), options);
}
function formatISO(date, options) {
  const _date = toDate(date);
  if (isNaN(_date.getTime())) {
    throw new RangeError("Invalid time value");
  }
  let result = "";
  let tzOffset = "";
  const dateDelimiter = "-";
  const timeDelimiter = ":";
  {
    const day = addLeadingZeros(_date.getDate(), 2);
    const month = addLeadingZeros(_date.getMonth() + 1, 2);
    const year = addLeadingZeros(_date.getFullYear(), 4);
    result = `${year}${dateDelimiter}${month}${dateDelimiter}${day}`;
  }
  {
    const offset2 = _date.getTimezoneOffset();
    if (offset2 !== 0) {
      const absoluteOffset = Math.abs(offset2);
      const hourOffset = addLeadingZeros(Math.trunc(absoluteOffset / 60), 2);
      const minuteOffset = addLeadingZeros(absoluteOffset % 60, 2);
      const sign = offset2 < 0 ? "+" : "-";
      tzOffset = `${sign}${hourOffset}:${minuteOffset}`;
    } else {
      tzOffset = "Z";
    }
    const hour = addLeadingZeros(_date.getHours(), 2);
    const minute = addLeadingZeros(_date.getMinutes(), 2);
    const second = addLeadingZeros(_date.getSeconds(), 2);
    const separator = result === "" ? "" : "T";
    const time = [hour, minute, second].join(timeDelimiter);
    result = `${result}${separator}${time}${tzOffset}`;
  }
  return result;
}
function subDays(date, amount) {
  return addDays(date, -amount);
}
function subHours(date, amount) {
  return addHours(date, -amount);
}
function subMinutes(date, amount) {
  return addMinutes(date, -15);
}
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const mergeClasses = (...classes) => classes.filter((className, index2, array) => {
  return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index2;
}).join(" ").trim();
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const toCamelCase = (string) => string.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (match2, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const toPascalCase = (string) => {
  const camelCase = toCamelCase(string);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
};
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const hasA11yProp = (props) => {
  for (const prop in props) {
    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
      return true;
    }
  }
  return false;
};
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Icon$1 = forwardRef(
  ({
    color = "currentColor",
    size: size2 = 24,
    strokeWidth = 2,
    absoluteStrokeWidth,
    className = "",
    children,
    iconNode,
    ...rest
  }, ref) => createElement(
    "svg",
    {
      ref,
      ...defaultAttributes,
      width: size2,
      height: size2,
      stroke: color,
      strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size2) : strokeWidth,
      className: mergeClasses("lucide", className),
      ...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
      ...rest
    },
    [
      ...iconNode.map(([tag, attrs]) => createElement(tag, attrs)),
      ...Array.isArray(children) ? children : [children]
    ]
  )
);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const createLucideIcon = (iconName, iconNode) => {
  const Component = forwardRef(
    ({ className, ...props }, ref) => createElement(Icon$1, {
      ref,
      iconNode,
      className: mergeClasses(
        `lucide-${toKebabCase(toPascalCase(iconName))}`,
        `lucide-${iconName}`,
        className
      ),
      ...props
    })
  );
  Component.displayName = toPascalCase(iconName);
  return Component;
};
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$b = [
  ["path", { d: "M8 2v4", key: "1cmpym" }],
  ["path", { d: "M16 2v4", key: "4m81vk" }],
  ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
  ["path", { d: "M3 10h18", key: "8toen8" }]
];
const Calendar = createLucideIcon("calendar", __iconNode$b);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$a = [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]];
const Check = createLucideIcon("check", __iconNode$a);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$9 = [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]];
const ChevronDown = createLucideIcon("chevron-down", __iconNode$9);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$8 = [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]];
const ChevronRight = createLucideIcon("chevron-right", __iconNode$8);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$7 = [["path", { d: "m18 15-6-6-6 6", key: "153udz" }]];
const ChevronUp = createLucideIcon("chevron-up", __iconNode$7);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$6 = [
  ["path", { d: "m7 15 5 5 5-5", key: "1hf1tw" }],
  ["path", { d: "m7 9 5-5 5 5", key: "sgt6xg" }]
];
const ChevronsUpDown = createLucideIcon("chevrons-up-down", __iconNode$6);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$5 = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
  ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
];
const CircleAlert = createLucideIcon("circle-alert", __iconNode$5);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$4 = [
  ["path", { d: "M21.801 10A10 10 0 1 1 17 3.335", key: "yps3ct" }],
  ["path", { d: "m9 11 3 3L22 4", key: "1pflzl" }]
];
const CircleCheckBig = createLucideIcon("circle-check-big", __iconNode$4);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$3 = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
  ["path", { d: "m9 9 6 6", key: "z0biqf" }]
];
const CircleX = createLucideIcon("circle-x", __iconNode$3);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$2 = [
  ["path", { d: "M12 6v6l4 2", key: "mmk7yg" }],
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
];
const Clock = createLucideIcon("clock", __iconNode$2);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$1 = [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]];
const LoaderCircle = createLucideIcon("loader-circle", __iconNode$1);
/**
 * @license lucide-react v0.563.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
  ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
];
const X$1 = createLucideIcon("x", __iconNode);
var U = 1, Y$1 = 0.9, H = 0.8, J = 0.17, p = 0.1, u = 0.999, $ = 0.9999;
var k$1 = 0.99, m = /[\\\/_+.#"@\[\(\{&]/, B$1 = /[\\\/_+.#"@\[\(\{&]/g, K$1 = /[\s-]/, X = /[\s-]/g;
function G(_, C, h, P2, A, f, O) {
  if (f === C.length) return A === _.length ? U : k$1;
  var T2 = `${A},${f}`;
  if (O[T2] !== void 0) return O[T2];
  for (var L2 = P2.charAt(f), c = h.indexOf(L2, A), S = 0, E, N2, R, M; c >= 0; ) E = G(_, C, h, P2, c + 1, f + 1, O), E > S && (c === A ? E *= U : m.test(_.charAt(c - 1)) ? (E *= H, R = _.slice(A, c - 1).match(B$1), R && A > 0 && (E *= Math.pow(u, R.length))) : K$1.test(_.charAt(c - 1)) ? (E *= Y$1, M = _.slice(A, c - 1).match(X), M && A > 0 && (E *= Math.pow(u, M.length))) : (E *= J, A > 0 && (E *= Math.pow(u, c - A))), _.charAt(c) !== C.charAt(f) && (E *= $)), (E < p && h.charAt(c - 1) === P2.charAt(f + 1) || P2.charAt(f + 1) === P2.charAt(f) && h.charAt(c - 1) !== P2.charAt(f)) && (N2 = G(_, C, h, P2, c + 1, f + 2, O), N2 * p > E && (E = N2 * p)), E > S && (S = E), c = h.indexOf(L2, c + 1);
  return O[T2] = S, S;
}
function D(_) {
  return _.toLowerCase().replace(X, " ");
}
function W(_, C, h) {
  return _ = h && h.length > 0 ? `${_ + " " + h.join(" ")}` : _, G(_, C, D(_), D(C), 0, 0, {});
}
function composeEventHandlers(originalEventHandler, ourEventHandler, { checkForDefaultPrevented = true } = {}) {
  return function handleEvent(event) {
    originalEventHandler == null ? void 0 : originalEventHandler(event);
    if (checkForDefaultPrevented === false || !event.defaultPrevented) {
      return ourEventHandler == null ? void 0 : ourEventHandler(event);
    }
  };
}
function createContext2(rootComponentName, defaultContext) {
  const Context = React.createContext(defaultContext);
  const Provider = (props) => {
    const { children, ...context } = props;
    const value = React.useMemo(() => context, Object.values(context));
    return /* @__PURE__ */ jsx(Context.Provider, { value, children });
  };
  Provider.displayName = rootComponentName + "Provider";
  function useContext2(consumerName) {
    const context = React.useContext(Context);
    if (context) return context;
    if (defaultContext !== void 0) return defaultContext;
    throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
  }
  return [Provider, useContext2];
}
function createContextScope(scopeName, createContextScopeDeps = []) {
  let defaultContexts = [];
  function createContext3(rootComponentName, defaultContext) {
    const BaseContext = React.createContext(defaultContext);
    const index2 = defaultContexts.length;
    defaultContexts = [...defaultContexts, defaultContext];
    const Provider = (props) => {
      var _a;
      const { scope, children, ...context } = props;
      const Context = ((_a = scope == null ? void 0 : scope[scopeName]) == null ? void 0 : _a[index2]) || BaseContext;
      const value = React.useMemo(() => context, Object.values(context));
      return /* @__PURE__ */ jsx(Context.Provider, { value, children });
    };
    Provider.displayName = rootComponentName + "Provider";
    function useContext2(consumerName, scope) {
      var _a;
      const Context = ((_a = scope == null ? void 0 : scope[scopeName]) == null ? void 0 : _a[index2]) || BaseContext;
      const context = React.useContext(Context);
      if (context) return context;
      if (defaultContext !== void 0) return defaultContext;
      throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
    }
    return [Provider, useContext2];
  }
  const createScope = () => {
    const scopeContexts = defaultContexts.map((defaultContext) => {
      return React.createContext(defaultContext);
    });
    return function useScope(scope) {
      const contexts = (scope == null ? void 0 : scope[scopeName]) || scopeContexts;
      return React.useMemo(
        () => ({ [`__scope${scopeName}`]: { ...scope, [scopeName]: contexts } }),
        [scope, contexts]
      );
    };
  };
  createScope.scopeName = scopeName;
  return [createContext3, composeContextScopes(createScope, ...createContextScopeDeps)];
}
function composeContextScopes(...scopes) {
  const baseScope = scopes[0];
  if (scopes.length === 1) return baseScope;
  const createScope = () => {
    const scopeHooks = scopes.map((createScope2) => ({
      useScope: createScope2(),
      scopeName: createScope2.scopeName
    }));
    return function useComposedScopes(overrideScopes) {
      const nextScopes = scopeHooks.reduce((nextScopes2, { useScope, scopeName }) => {
        const scopeProps = useScope(overrideScopes);
        const currentScope = scopeProps[`__scope${scopeName}`];
        return { ...nextScopes2, ...currentScope };
      }, {});
      return React.useMemo(() => ({ [`__scope${baseScope.scopeName}`]: nextScopes }), [nextScopes]);
    };
  };
  createScope.scopeName = baseScope.scopeName;
  return createScope;
}
var useLayoutEffect2 = (globalThis == null ? void 0 : globalThis.document) ? React.useLayoutEffect : () => {
};
var useReactId = React[" useId ".trim().toString()] || (() => void 0);
var count$1 = 0;
function useId(deterministicId) {
  const [id, setId] = React.useState(useReactId());
  useLayoutEffect2(() => {
    setId((reactId) => reactId ?? String(count$1++));
  }, [deterministicId]);
  return id ? `radix-${id}` : "";
}
var useInsertionEffect = React[" useInsertionEffect ".trim().toString()] || useLayoutEffect2;
function useControllableState({
  prop,
  defaultProp,
  onChange = () => {
  },
  caller
}) {
  const [uncontrolledProp, setUncontrolledProp, onChangeRef] = useUncontrolledState({
    defaultProp,
    onChange
  });
  const isControlled = prop !== void 0;
  const value = isControlled ? prop : uncontrolledProp;
  {
    const isControlledRef = React.useRef(prop !== void 0);
    React.useEffect(() => {
      const wasControlled = isControlledRef.current;
      if (wasControlled !== isControlled) {
        const from = wasControlled ? "controlled" : "uncontrolled";
        const to = isControlled ? "controlled" : "uncontrolled";
        console.warn(
          `${caller} is changing from ${from} to ${to}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`
        );
      }
      isControlledRef.current = isControlled;
    }, [isControlled, caller]);
  }
  const setValue = React.useCallback(
    (nextValue) => {
      var _a;
      if (isControlled) {
        const value2 = isFunction$1(nextValue) ? nextValue(prop) : nextValue;
        if (value2 !== prop) {
          (_a = onChangeRef.current) == null ? void 0 : _a.call(onChangeRef, value2);
        }
      } else {
        setUncontrolledProp(nextValue);
      }
    },
    [isControlled, prop, setUncontrolledProp, onChangeRef]
  );
  return [value, setValue];
}
function useUncontrolledState({
  defaultProp,
  onChange
}) {
  const [value, setValue] = React.useState(defaultProp);
  const prevValueRef = React.useRef(value);
  const onChangeRef = React.useRef(onChange);
  useInsertionEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  React.useEffect(() => {
    var _a;
    if (prevValueRef.current !== value) {
      (_a = onChangeRef.current) == null ? void 0 : _a.call(onChangeRef, value);
      prevValueRef.current = value;
    }
  }, [value, prevValueRef]);
  return [value, setValue, onChangeRef];
}
function isFunction$1(value) {
  return typeof value === "function";
}
// @__NO_SIDE_EFFECTS__
function createSlot(ownerName) {
  const SlotClone = /* @__PURE__ */ createSlotClone(ownerName);
  const Slot2 = React.forwardRef((props, forwardedRef) => {
    const { children, ...slotProps } = props;
    const childrenArray = React.Children.toArray(children);
    const slottable = childrenArray.find(isSlottable);
    if (slottable) {
      const newElement = slottable.props.children;
      const newChildren = childrenArray.map((child) => {
        if (child === slottable) {
          if (React.Children.count(newElement) > 1) return React.Children.only(null);
          return React.isValidElement(newElement) ? newElement.props.children : null;
        } else {
          return child;
        }
      });
      return /* @__PURE__ */ jsx(SlotClone, { ...slotProps, ref: forwardedRef, children: React.isValidElement(newElement) ? React.cloneElement(newElement, void 0, newChildren) : null });
    }
    return /* @__PURE__ */ jsx(SlotClone, { ...slotProps, ref: forwardedRef, children });
  });
  Slot2.displayName = `${ownerName}.Slot`;
  return Slot2;
}
// @__NO_SIDE_EFFECTS__
function createSlotClone(ownerName) {
  const SlotClone = React.forwardRef((props, forwardedRef) => {
    const { children, ...slotProps } = props;
    if (React.isValidElement(children)) {
      const childrenRef = getElementRef$1(children);
      const props2 = mergeProps(slotProps, children.props);
      if (children.type !== React.Fragment) {
        props2.ref = forwardedRef ? composeRefs(forwardedRef, childrenRef) : childrenRef;
      }
      return React.cloneElement(children, props2);
    }
    return React.Children.count(children) > 1 ? React.Children.only(null) : null;
  });
  SlotClone.displayName = `${ownerName}.SlotClone`;
  return SlotClone;
}
var SLOTTABLE_IDENTIFIER = Symbol("radix.slottable");
function isSlottable(child) {
  return React.isValidElement(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER;
}
function mergeProps(slotProps, childProps) {
  const overrideProps = { ...childProps };
  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];
    const isHandler = /^on[A-Z]/.test(propName);
    if (isHandler) {
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args) => {
          const result = childPropValue(...args);
          slotPropValue(...args);
          return result;
        };
      } else if (slotPropValue) {
        overrideProps[propName] = slotPropValue;
      }
    } else if (propName === "style") {
      overrideProps[propName] = { ...slotPropValue, ...childPropValue };
    } else if (propName === "className") {
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
    }
  }
  return { ...slotProps, ...overrideProps };
}
function getElementRef$1(element) {
  var _a, _b;
  let getter = (_a = Object.getOwnPropertyDescriptor(element.props, "ref")) == null ? void 0 : _a.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.ref;
  }
  getter = (_b = Object.getOwnPropertyDescriptor(element, "ref")) == null ? void 0 : _b.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }
  return element.props.ref || element.ref;
}
var NODES = [
  "a",
  "button",
  "div",
  "form",
  "h2",
  "h3",
  "img",
  "input",
  "label",
  "li",
  "nav",
  "ol",
  "p",
  "select",
  "span",
  "svg",
  "ul"
];
var Primitive = NODES.reduce((primitive, node) => {
  const Slot2 = /* @__PURE__ */ createSlot(`Primitive.${node}`);
  const Node2 = React.forwardRef((props, forwardedRef) => {
    const { asChild, ...primitiveProps } = props;
    const Comp = asChild ? Slot2 : node;
    if (typeof window !== "undefined") {
      window[Symbol.for("radix-ui")] = true;
    }
    return /* @__PURE__ */ jsx(Comp, { ...primitiveProps, ref: forwardedRef });
  });
  Node2.displayName = `Primitive.${node}`;
  return { ...primitive, [node]: Node2 };
}, {});
function dispatchDiscreteCustomEvent(target, event) {
  if (target) ReactDOM.flushSync(() => target.dispatchEvent(event));
}
function useCallbackRef$1(callback) {
  const callbackRef = React.useRef(callback);
  React.useEffect(() => {
    callbackRef.current = callback;
  });
  return React.useMemo(() => (...args) => {
    var _a;
    return (_a = callbackRef.current) == null ? void 0 : _a.call(callbackRef, ...args);
  }, []);
}
function useEscapeKeydown(onEscapeKeyDownProp, ownerDocument = globalThis == null ? void 0 : globalThis.document) {
  const onEscapeKeyDown = useCallbackRef$1(onEscapeKeyDownProp);
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onEscapeKeyDown(event);
      }
    };
    ownerDocument.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => ownerDocument.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onEscapeKeyDown, ownerDocument]);
}
var DISMISSABLE_LAYER_NAME = "DismissableLayer";
var CONTEXT_UPDATE = "dismissableLayer.update";
var POINTER_DOWN_OUTSIDE = "dismissableLayer.pointerDownOutside";
var FOCUS_OUTSIDE = "dismissableLayer.focusOutside";
var originalBodyPointerEvents;
var DismissableLayerContext = React.createContext({
  layers: /* @__PURE__ */ new Set(),
  layersWithOutsidePointerEventsDisabled: /* @__PURE__ */ new Set(),
  branches: /* @__PURE__ */ new Set()
});
var DismissableLayer = React.forwardRef(
  (props, forwardedRef) => {
    const {
      disableOutsidePointerEvents = false,
      onEscapeKeyDown,
      onPointerDownOutside,
      onFocusOutside,
      onInteractOutside,
      onDismiss,
      ...layerProps
    } = props;
    const context = React.useContext(DismissableLayerContext);
    const [node, setNode] = React.useState(null);
    const ownerDocument = (node == null ? void 0 : node.ownerDocument) ?? (globalThis == null ? void 0 : globalThis.document);
    const [, force] = React.useState({});
    const composedRefs = useComposedRefs(forwardedRef, (node2) => setNode(node2));
    const layers = Array.from(context.layers);
    const [highestLayerWithOutsidePointerEventsDisabled] = [...context.layersWithOutsidePointerEventsDisabled].slice(-1);
    const highestLayerWithOutsidePointerEventsDisabledIndex = layers.indexOf(highestLayerWithOutsidePointerEventsDisabled);
    const index2 = node ? layers.indexOf(node) : -1;
    const isBodyPointerEventsDisabled = context.layersWithOutsidePointerEventsDisabled.size > 0;
    const isPointerEventsEnabled = index2 >= highestLayerWithOutsidePointerEventsDisabledIndex;
    const pointerDownOutside = usePointerDownOutside((event) => {
      const target = event.target;
      const isPointerDownOnBranch = [...context.branches].some((branch) => branch.contains(target));
      if (!isPointerEventsEnabled || isPointerDownOnBranch) return;
      onPointerDownOutside == null ? void 0 : onPointerDownOutside(event);
      onInteractOutside == null ? void 0 : onInteractOutside(event);
      if (!event.defaultPrevented) onDismiss == null ? void 0 : onDismiss();
    }, ownerDocument);
    const focusOutside = useFocusOutside((event) => {
      const target = event.target;
      const isFocusInBranch = [...context.branches].some((branch) => branch.contains(target));
      if (isFocusInBranch) return;
      onFocusOutside == null ? void 0 : onFocusOutside(event);
      onInteractOutside == null ? void 0 : onInteractOutside(event);
      if (!event.defaultPrevented) onDismiss == null ? void 0 : onDismiss();
    }, ownerDocument);
    useEscapeKeydown((event) => {
      const isHighestLayer = index2 === context.layers.size - 1;
      if (!isHighestLayer) return;
      onEscapeKeyDown == null ? void 0 : onEscapeKeyDown(event);
      if (!event.defaultPrevented && onDismiss) {
        event.preventDefault();
        onDismiss();
      }
    }, ownerDocument);
    React.useEffect(() => {
      if (!node) return;
      if (disableOutsidePointerEvents) {
        if (context.layersWithOutsidePointerEventsDisabled.size === 0) {
          originalBodyPointerEvents = ownerDocument.body.style.pointerEvents;
          ownerDocument.body.style.pointerEvents = "none";
        }
        context.layersWithOutsidePointerEventsDisabled.add(node);
      }
      context.layers.add(node);
      dispatchUpdate();
      return () => {
        if (disableOutsidePointerEvents && context.layersWithOutsidePointerEventsDisabled.size === 1) {
          ownerDocument.body.style.pointerEvents = originalBodyPointerEvents;
        }
      };
    }, [node, ownerDocument, disableOutsidePointerEvents, context]);
    React.useEffect(() => {
      return () => {
        if (!node) return;
        context.layers.delete(node);
        context.layersWithOutsidePointerEventsDisabled.delete(node);
        dispatchUpdate();
      };
    }, [node, context]);
    React.useEffect(() => {
      const handleUpdate = () => force({});
      document.addEventListener(CONTEXT_UPDATE, handleUpdate);
      return () => document.removeEventListener(CONTEXT_UPDATE, handleUpdate);
    }, []);
    return /* @__PURE__ */ jsx(
      Primitive.div,
      {
        ...layerProps,
        ref: composedRefs,
        style: {
          pointerEvents: isBodyPointerEventsDisabled ? isPointerEventsEnabled ? "auto" : "none" : void 0,
          ...props.style
        },
        onFocusCapture: composeEventHandlers(props.onFocusCapture, focusOutside.onFocusCapture),
        onBlurCapture: composeEventHandlers(props.onBlurCapture, focusOutside.onBlurCapture),
        onPointerDownCapture: composeEventHandlers(
          props.onPointerDownCapture,
          pointerDownOutside.onPointerDownCapture
        )
      }
    );
  }
);
DismissableLayer.displayName = DISMISSABLE_LAYER_NAME;
var BRANCH_NAME = "DismissableLayerBranch";
var DismissableLayerBranch = React.forwardRef((props, forwardedRef) => {
  const context = React.useContext(DismissableLayerContext);
  const ref = React.useRef(null);
  const composedRefs = useComposedRefs(forwardedRef, ref);
  React.useEffect(() => {
    const node = ref.current;
    if (node) {
      context.branches.add(node);
      return () => {
        context.branches.delete(node);
      };
    }
  }, [context.branches]);
  return /* @__PURE__ */ jsx(Primitive.div, { ...props, ref: composedRefs });
});
DismissableLayerBranch.displayName = BRANCH_NAME;
function usePointerDownOutside(onPointerDownOutside, ownerDocument = globalThis == null ? void 0 : globalThis.document) {
  const handlePointerDownOutside = useCallbackRef$1(onPointerDownOutside);
  const isPointerInsideReactTreeRef = React.useRef(false);
  const handleClickRef = React.useRef(() => {
  });
  React.useEffect(() => {
    const handlePointerDown = (event) => {
      if (event.target && !isPointerInsideReactTreeRef.current) {
        let handleAndDispatchPointerDownOutsideEvent2 = function() {
          handleAndDispatchCustomEvent(
            POINTER_DOWN_OUTSIDE,
            handlePointerDownOutside,
            eventDetail,
            { discrete: true }
          );
        };
        const eventDetail = { originalEvent: event };
        if (event.pointerType === "touch") {
          ownerDocument.removeEventListener("click", handleClickRef.current);
          handleClickRef.current = handleAndDispatchPointerDownOutsideEvent2;
          ownerDocument.addEventListener("click", handleClickRef.current, { once: true });
        } else {
          handleAndDispatchPointerDownOutsideEvent2();
        }
      } else {
        ownerDocument.removeEventListener("click", handleClickRef.current);
      }
      isPointerInsideReactTreeRef.current = false;
    };
    const timerId = window.setTimeout(() => {
      ownerDocument.addEventListener("pointerdown", handlePointerDown);
    }, 0);
    return () => {
      window.clearTimeout(timerId);
      ownerDocument.removeEventListener("pointerdown", handlePointerDown);
      ownerDocument.removeEventListener("click", handleClickRef.current);
    };
  }, [ownerDocument, handlePointerDownOutside]);
  return {
    // ensures we check React component tree (not just DOM tree)
    onPointerDownCapture: () => isPointerInsideReactTreeRef.current = true
  };
}
function useFocusOutside(onFocusOutside, ownerDocument = globalThis == null ? void 0 : globalThis.document) {
  const handleFocusOutside = useCallbackRef$1(onFocusOutside);
  const isFocusInsideReactTreeRef = React.useRef(false);
  React.useEffect(() => {
    const handleFocus = (event) => {
      if (event.target && !isFocusInsideReactTreeRef.current) {
        const eventDetail = { originalEvent: event };
        handleAndDispatchCustomEvent(FOCUS_OUTSIDE, handleFocusOutside, eventDetail, {
          discrete: false
        });
      }
    };
    ownerDocument.addEventListener("focusin", handleFocus);
    return () => ownerDocument.removeEventListener("focusin", handleFocus);
  }, [ownerDocument, handleFocusOutside]);
  return {
    onFocusCapture: () => isFocusInsideReactTreeRef.current = true,
    onBlurCapture: () => isFocusInsideReactTreeRef.current = false
  };
}
function dispatchUpdate() {
  const event = new CustomEvent(CONTEXT_UPDATE);
  document.dispatchEvent(event);
}
function handleAndDispatchCustomEvent(name, handler, detail, { discrete }) {
  const target = detail.originalEvent.target;
  const event = new CustomEvent(name, { bubbles: false, cancelable: true, detail });
  if (handler) target.addEventListener(name, handler, { once: true });
  if (discrete) {
    dispatchDiscreteCustomEvent(target, event);
  } else {
    target.dispatchEvent(event);
  }
}
var AUTOFOCUS_ON_MOUNT = "focusScope.autoFocusOnMount";
var AUTOFOCUS_ON_UNMOUNT = "focusScope.autoFocusOnUnmount";
var EVENT_OPTIONS$1 = { bubbles: false, cancelable: true };
var FOCUS_SCOPE_NAME = "FocusScope";
var FocusScope = React.forwardRef((props, forwardedRef) => {
  const {
    loop = false,
    trapped = false,
    onMountAutoFocus: onMountAutoFocusProp,
    onUnmountAutoFocus: onUnmountAutoFocusProp,
    ...scopeProps
  } = props;
  const [container, setContainer] = React.useState(null);
  const onMountAutoFocus = useCallbackRef$1(onMountAutoFocusProp);
  const onUnmountAutoFocus = useCallbackRef$1(onUnmountAutoFocusProp);
  const lastFocusedElementRef = React.useRef(null);
  const composedRefs = useComposedRefs(forwardedRef, (node) => setContainer(node));
  const focusScope = React.useRef({
    paused: false,
    pause() {
      this.paused = true;
    },
    resume() {
      this.paused = false;
    }
  }).current;
  React.useEffect(() => {
    if (trapped) {
      let handleFocusIn2 = function(event) {
        if (focusScope.paused || !container) return;
        const target = event.target;
        if (container.contains(target)) {
          lastFocusedElementRef.current = target;
        } else {
          focus(lastFocusedElementRef.current, { select: true });
        }
      }, handleFocusOut2 = function(event) {
        if (focusScope.paused || !container) return;
        const relatedTarget = event.relatedTarget;
        if (relatedTarget === null) return;
        if (!container.contains(relatedTarget)) {
          focus(lastFocusedElementRef.current, { select: true });
        }
      }, handleMutations2 = function(mutations) {
        const focusedElement = document.activeElement;
        if (focusedElement !== document.body) return;
        for (const mutation of mutations) {
          if (mutation.removedNodes.length > 0) focus(container);
        }
      };
      document.addEventListener("focusin", handleFocusIn2);
      document.addEventListener("focusout", handleFocusOut2);
      const mutationObserver = new MutationObserver(handleMutations2);
      if (container) mutationObserver.observe(container, { childList: true, subtree: true });
      return () => {
        document.removeEventListener("focusin", handleFocusIn2);
        document.removeEventListener("focusout", handleFocusOut2);
        mutationObserver.disconnect();
      };
    }
  }, [trapped, container, focusScope.paused]);
  React.useEffect(() => {
    if (container) {
      focusScopesStack.add(focusScope);
      const previouslyFocusedElement = document.activeElement;
      const hasFocusedCandidate = container.contains(previouslyFocusedElement);
      if (!hasFocusedCandidate) {
        const mountEvent = new CustomEvent(AUTOFOCUS_ON_MOUNT, EVENT_OPTIONS$1);
        container.addEventListener(AUTOFOCUS_ON_MOUNT, onMountAutoFocus);
        container.dispatchEvent(mountEvent);
        if (!mountEvent.defaultPrevented) {
          focusFirst$1(removeLinks(getTabbableCandidates(container)), { select: true });
          if (document.activeElement === previouslyFocusedElement) {
            focus(container);
          }
        }
      }
      return () => {
        container.removeEventListener(AUTOFOCUS_ON_MOUNT, onMountAutoFocus);
        setTimeout(() => {
          const unmountEvent = new CustomEvent(AUTOFOCUS_ON_UNMOUNT, EVENT_OPTIONS$1);
          container.addEventListener(AUTOFOCUS_ON_UNMOUNT, onUnmountAutoFocus);
          container.dispatchEvent(unmountEvent);
          if (!unmountEvent.defaultPrevented) {
            focus(previouslyFocusedElement ?? document.body, { select: true });
          }
          container.removeEventListener(AUTOFOCUS_ON_UNMOUNT, onUnmountAutoFocus);
          focusScopesStack.remove(focusScope);
        }, 0);
      };
    }
  }, [container, onMountAutoFocus, onUnmountAutoFocus, focusScope]);
  const handleKeyDown = React.useCallback(
    (event) => {
      if (!loop && !trapped) return;
      if (focusScope.paused) return;
      const isTabKey = event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey;
      const focusedElement = document.activeElement;
      if (isTabKey && focusedElement) {
        const container2 = event.currentTarget;
        const [first, last] = getTabbableEdges(container2);
        const hasTabbableElementsInside = first && last;
        if (!hasTabbableElementsInside) {
          if (focusedElement === container2) event.preventDefault();
        } else {
          if (!event.shiftKey && focusedElement === last) {
            event.preventDefault();
            if (loop) focus(first, { select: true });
          } else if (event.shiftKey && focusedElement === first) {
            event.preventDefault();
            if (loop) focus(last, { select: true });
          }
        }
      }
    },
    [loop, trapped, focusScope.paused]
  );
  return /* @__PURE__ */ jsx(Primitive.div, { tabIndex: -1, ...scopeProps, ref: composedRefs, onKeyDown: handleKeyDown });
});
FocusScope.displayName = FOCUS_SCOPE_NAME;
function focusFirst$1(candidates, { select = false } = {}) {
  const previouslyFocusedElement = document.activeElement;
  for (const candidate of candidates) {
    focus(candidate, { select });
    if (document.activeElement !== previouslyFocusedElement) return;
  }
}
function getTabbableEdges(container) {
  const candidates = getTabbableCandidates(container);
  const first = findVisible(candidates, container);
  const last = findVisible(candidates.reverse(), container);
  return [first, last];
}
function getTabbableCandidates(container) {
  const nodes = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const isHiddenInput = node.tagName === "INPUT" && node.type === "hidden";
      if (node.disabled || node.hidden || isHiddenInput) return NodeFilter.FILTER_SKIP;
      return node.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}
function findVisible(elements, container) {
  for (const element of elements) {
    if (!isHidden(element, { upTo: container })) return element;
  }
}
function isHidden(node, { upTo }) {
  if (getComputedStyle(node).visibility === "hidden") return true;
  while (node) {
    if (upTo !== void 0 && node === upTo) return false;
    if (getComputedStyle(node).display === "none") return true;
    node = node.parentElement;
  }
  return false;
}
function isSelectableInput(element) {
  return element instanceof HTMLInputElement && "select" in element;
}
function focus(element, { select = false } = {}) {
  if (element && element.focus) {
    const previouslyFocusedElement = document.activeElement;
    element.focus({ preventScroll: true });
    if (element !== previouslyFocusedElement && isSelectableInput(element) && select)
      element.select();
  }
}
var focusScopesStack = createFocusScopesStack();
function createFocusScopesStack() {
  let stack = [];
  return {
    add(focusScope) {
      const activeFocusScope = stack[0];
      if (focusScope !== activeFocusScope) {
        activeFocusScope == null ? void 0 : activeFocusScope.pause();
      }
      stack = arrayRemove(stack, focusScope);
      stack.unshift(focusScope);
    },
    remove(focusScope) {
      var _a;
      stack = arrayRemove(stack, focusScope);
      (_a = stack[0]) == null ? void 0 : _a.resume();
    }
  };
}
function arrayRemove(array, item) {
  const updatedArray = [...array];
  const index2 = updatedArray.indexOf(item);
  if (index2 !== -1) {
    updatedArray.splice(index2, 1);
  }
  return updatedArray;
}
function removeLinks(items) {
  return items.filter((item) => item.tagName !== "A");
}
var PORTAL_NAME$3 = "Portal";
var Portal$3 = React.forwardRef((props, forwardedRef) => {
  var _a;
  const { container: containerProp, ...portalProps } = props;
  const [mounted, setMounted] = React.useState(false);
  useLayoutEffect2(() => setMounted(true), []);
  const container = containerProp || mounted && ((_a = globalThis == null ? void 0 : globalThis.document) == null ? void 0 : _a.body);
  return container ? ReactDOM__default.createPortal(/* @__PURE__ */ jsx(Primitive.div, { ...portalProps, ref: forwardedRef }), container) : null;
});
Portal$3.displayName = PORTAL_NAME$3;
function useStateMachine(initialState, machine) {
  return React.useReducer((state, event) => {
    const nextState = machine[state][event];
    return nextState ?? state;
  }, initialState);
}
var Presence = (props) => {
  const { present, children } = props;
  const presence = usePresence(present);
  const child = typeof children === "function" ? children({ present: presence.isPresent }) : React.Children.only(children);
  const ref = useComposedRefs(presence.ref, getElementRef(child));
  const forceMount = typeof children === "function";
  return forceMount || presence.isPresent ? React.cloneElement(child, { ref }) : null;
};
Presence.displayName = "Presence";
function usePresence(present) {
  const [node, setNode] = React.useState();
  const stylesRef = React.useRef(null);
  const prevPresentRef = React.useRef(present);
  const prevAnimationNameRef = React.useRef("none");
  const initialState = present ? "mounted" : "unmounted";
  const [state, send] = useStateMachine(initialState, {
    mounted: {
      UNMOUNT: "unmounted",
      ANIMATION_OUT: "unmountSuspended"
    },
    unmountSuspended: {
      MOUNT: "mounted",
      ANIMATION_END: "unmounted"
    },
    unmounted: {
      MOUNT: "mounted"
    }
  });
  React.useEffect(() => {
    const currentAnimationName = getAnimationName(stylesRef.current);
    prevAnimationNameRef.current = state === "mounted" ? currentAnimationName : "none";
  }, [state]);
  useLayoutEffect2(() => {
    const styles = stylesRef.current;
    const wasPresent = prevPresentRef.current;
    const hasPresentChanged = wasPresent !== present;
    if (hasPresentChanged) {
      const prevAnimationName = prevAnimationNameRef.current;
      const currentAnimationName = getAnimationName(styles);
      if (present) {
        send("MOUNT");
      } else if (currentAnimationName === "none" || (styles == null ? void 0 : styles.display) === "none") {
        send("UNMOUNT");
      } else {
        const isAnimating = prevAnimationName !== currentAnimationName;
        if (wasPresent && isAnimating) {
          send("ANIMATION_OUT");
        } else {
          send("UNMOUNT");
        }
      }
      prevPresentRef.current = present;
    }
  }, [present, send]);
  useLayoutEffect2(() => {
    if (node) {
      let timeoutId;
      const ownerWindow = node.ownerDocument.defaultView ?? window;
      const handleAnimationEnd = (event) => {
        const currentAnimationName = getAnimationName(stylesRef.current);
        const isCurrentAnimation = currentAnimationName.includes(CSS.escape(event.animationName));
        if (event.target === node && isCurrentAnimation) {
          send("ANIMATION_END");
          if (!prevPresentRef.current) {
            const currentFillMode = node.style.animationFillMode;
            node.style.animationFillMode = "forwards";
            timeoutId = ownerWindow.setTimeout(() => {
              if (node.style.animationFillMode === "forwards") {
                node.style.animationFillMode = currentFillMode;
              }
            });
          }
        }
      };
      const handleAnimationStart = (event) => {
        if (event.target === node) {
          prevAnimationNameRef.current = getAnimationName(stylesRef.current);
        }
      };
      node.addEventListener("animationstart", handleAnimationStart);
      node.addEventListener("animationcancel", handleAnimationEnd);
      node.addEventListener("animationend", handleAnimationEnd);
      return () => {
        ownerWindow.clearTimeout(timeoutId);
        node.removeEventListener("animationstart", handleAnimationStart);
        node.removeEventListener("animationcancel", handleAnimationEnd);
        node.removeEventListener("animationend", handleAnimationEnd);
      };
    } else {
      send("ANIMATION_END");
    }
  }, [node, send]);
  return {
    isPresent: ["mounted", "unmountSuspended"].includes(state),
    ref: React.useCallback((node2) => {
      stylesRef.current = node2 ? getComputedStyle(node2) : null;
      setNode(node2);
    }, [])
  };
}
function getAnimationName(styles) {
  return (styles == null ? void 0 : styles.animationName) || "none";
}
function getElementRef(element) {
  var _a, _b;
  let getter = (_a = Object.getOwnPropertyDescriptor(element.props, "ref")) == null ? void 0 : _a.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.ref;
  }
  getter = (_b = Object.getOwnPropertyDescriptor(element, "ref")) == null ? void 0 : _b.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }
  return element.props.ref || element.ref;
}
var count = 0;
function useFocusGuards() {
  React.useEffect(() => {
    const edgeGuards = document.querySelectorAll("[data-radix-focus-guard]");
    document.body.insertAdjacentElement("afterbegin", edgeGuards[0] ?? createFocusGuard());
    document.body.insertAdjacentElement("beforeend", edgeGuards[1] ?? createFocusGuard());
    count++;
    return () => {
      if (count === 1) {
        document.querySelectorAll("[data-radix-focus-guard]").forEach((node) => node.remove());
      }
      count--;
    };
  }, []);
}
function createFocusGuard() {
  const element = document.createElement("span");
  element.setAttribute("data-radix-focus-guard", "");
  element.tabIndex = 0;
  element.style.outline = "none";
  element.style.opacity = "0";
  element.style.position = "fixed";
  element.style.pointerEvents = "none";
  return element;
}
var __assign = function() {
  __assign = Object.assign || function __assign2(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
      s = arguments[i];
      for (var p2 in s) if (Object.prototype.hasOwnProperty.call(s, p2)) t[p2] = s[p2];
    }
    return t;
  };
  return __assign.apply(this, arguments);
};
function __rest(s, e) {
  var t = {};
  for (var p2 in s) if (Object.prototype.hasOwnProperty.call(s, p2) && e.indexOf(p2) < 0)
    t[p2] = s[p2];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p2 = Object.getOwnPropertySymbols(s); i < p2.length; i++) {
      if (e.indexOf(p2[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p2[i]))
        t[p2[i]] = s[p2[i]];
    }
  return t;
}
function __spreadArray(to, from, pack) {
  for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
}
typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message2) {
  var e = new Error(message2);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};
var zeroRightClassName = "right-scroll-bar-position";
var fullWidthClassName = "width-before-scroll-bar";
var noScrollbarsClassName = "with-scroll-bars-hidden";
var removedBarSizeVariable = "--removed-body-scroll-bar-size";
function assignRef(ref, value) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
  return ref;
}
function useCallbackRef(initialValue, callback) {
  var ref = useState(function() {
    return {
      // value
      value: initialValue,
      // last callback
      callback,
      // "memoized" public interface
      facade: {
        get current() {
          return ref.value;
        },
        set current(value) {
          var last = ref.value;
          if (last !== value) {
            ref.value = value;
            ref.callback(value, last);
          }
        }
      }
    };
  })[0];
  ref.callback = callback;
  return ref.facade;
}
var useIsomorphicLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;
var currentValues = /* @__PURE__ */ new WeakMap();
function useMergeRefs(refs, defaultValue) {
  var callbackRef = useCallbackRef(null, function(newValue) {
    return refs.forEach(function(ref) {
      return assignRef(ref, newValue);
    });
  });
  useIsomorphicLayoutEffect(function() {
    var oldValue = currentValues.get(callbackRef);
    if (oldValue) {
      var prevRefs_1 = new Set(oldValue);
      var nextRefs_1 = new Set(refs);
      var current_1 = callbackRef.current;
      prevRefs_1.forEach(function(ref) {
        if (!nextRefs_1.has(ref)) {
          assignRef(ref, null);
        }
      });
      nextRefs_1.forEach(function(ref) {
        if (!prevRefs_1.has(ref)) {
          assignRef(ref, current_1);
        }
      });
    }
    currentValues.set(callbackRef, refs);
  }, [refs]);
  return callbackRef;
}
function ItoI(a) {
  return a;
}
function innerCreateMedium(defaults, middleware) {
  if (middleware === void 0) {
    middleware = ItoI;
  }
  var buffer = [];
  var assigned = false;
  var medium = {
    read: function() {
      if (assigned) {
        throw new Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
      }
      if (buffer.length) {
        return buffer[buffer.length - 1];
      }
      return defaults;
    },
    useMedium: function(data) {
      var item = middleware(data, assigned);
      buffer.push(item);
      return function() {
        buffer = buffer.filter(function(x) {
          return x !== item;
        });
      };
    },
    assignSyncMedium: function(cb) {
      assigned = true;
      while (buffer.length) {
        var cbs = buffer;
        buffer = [];
        cbs.forEach(cb);
      }
      buffer = {
        push: function(x) {
          return cb(x);
        },
        filter: function() {
          return buffer;
        }
      };
    },
    assignMedium: function(cb) {
      assigned = true;
      var pendingQueue = [];
      if (buffer.length) {
        var cbs = buffer;
        buffer = [];
        cbs.forEach(cb);
        pendingQueue = buffer;
      }
      var executeQueue = function() {
        var cbs2 = pendingQueue;
        pendingQueue = [];
        cbs2.forEach(cb);
      };
      var cycle = function() {
        return Promise.resolve().then(executeQueue);
      };
      cycle();
      buffer = {
        push: function(x) {
          pendingQueue.push(x);
          cycle();
        },
        filter: function(filter) {
          pendingQueue = pendingQueue.filter(filter);
          return buffer;
        }
      };
    }
  };
  return medium;
}
function createSidecarMedium(options) {
  if (options === void 0) {
    options = {};
  }
  var medium = innerCreateMedium(null);
  medium.options = __assign({ async: true, ssr: false }, options);
  return medium;
}
var SideCar$1 = function(_a) {
  var sideCar = _a.sideCar, rest = __rest(_a, ["sideCar"]);
  if (!sideCar) {
    throw new Error("Sidecar: please provide `sideCar` property to import the right car");
  }
  var Target = sideCar.read();
  if (!Target) {
    throw new Error("Sidecar medium not found");
  }
  return React.createElement(Target, __assign({}, rest));
};
SideCar$1.isSideCarExport = true;
function exportSidecar(medium, exported) {
  medium.useMedium(exported);
  return SideCar$1;
}
var effectCar = createSidecarMedium();
var nothing = function() {
  return;
};
var RemoveScroll = React.forwardRef(function(props, parentRef) {
  var ref = React.useRef(null);
  var _a = React.useState({
    onScrollCapture: nothing,
    onWheelCapture: nothing,
    onTouchMoveCapture: nothing
  }), callbacks = _a[0], setCallbacks = _a[1];
  var forwardProps = props.forwardProps, children = props.children, className = props.className, removeScrollBar = props.removeScrollBar, enabled = props.enabled, shards = props.shards, sideCar = props.sideCar, noRelative = props.noRelative, noIsolation = props.noIsolation, inert = props.inert, allowPinchZoom = props.allowPinchZoom, _b = props.as, Container = _b === void 0 ? "div" : _b, gapMode = props.gapMode, rest = __rest(props, ["forwardProps", "children", "className", "removeScrollBar", "enabled", "shards", "sideCar", "noRelative", "noIsolation", "inert", "allowPinchZoom", "as", "gapMode"]);
  var SideCar2 = sideCar;
  var containerRef = useMergeRefs([ref, parentRef]);
  var containerProps = __assign(__assign({}, rest), callbacks);
  return React.createElement(
    React.Fragment,
    null,
    enabled && React.createElement(SideCar2, { sideCar: effectCar, removeScrollBar, shards, noRelative, noIsolation, inert, setCallbacks, allowPinchZoom: !!allowPinchZoom, lockRef: ref, gapMode }),
    forwardProps ? React.cloneElement(React.Children.only(children), __assign(__assign({}, containerProps), { ref: containerRef })) : React.createElement(Container, __assign({}, containerProps, { className, ref: containerRef }), children)
  );
});
RemoveScroll.defaultProps = {
  enabled: true,
  removeScrollBar: true,
  inert: false
};
RemoveScroll.classNames = {
  fullWidth: fullWidthClassName,
  zeroRight: zeroRightClassName
};
var getNonce = function() {
  if (typeof __webpack_nonce__ !== "undefined") {
    return __webpack_nonce__;
  }
  return void 0;
};
function makeStyleTag() {
  if (!document)
    return null;
  var tag = document.createElement("style");
  tag.type = "text/css";
  var nonce = getNonce();
  if (nonce) {
    tag.setAttribute("nonce", nonce);
  }
  return tag;
}
function injectStyles(tag, css) {
  if (tag.styleSheet) {
    tag.styleSheet.cssText = css;
  } else {
    tag.appendChild(document.createTextNode(css));
  }
}
function insertStyleTag(tag) {
  var head = document.head || document.getElementsByTagName("head")[0];
  head.appendChild(tag);
}
var stylesheetSingleton = function() {
  var counter = 0;
  var stylesheet = null;
  return {
    add: function(style) {
      if (counter == 0) {
        if (stylesheet = makeStyleTag()) {
          injectStyles(stylesheet, style);
          insertStyleTag(stylesheet);
        }
      }
      counter++;
    },
    remove: function() {
      counter--;
      if (!counter && stylesheet) {
        stylesheet.parentNode && stylesheet.parentNode.removeChild(stylesheet);
        stylesheet = null;
      }
    }
  };
};
var styleHookSingleton = function() {
  var sheet = stylesheetSingleton();
  return function(styles, isDynamic) {
    React.useEffect(function() {
      sheet.add(styles);
      return function() {
        sheet.remove();
      };
    }, [styles && isDynamic]);
  };
};
var styleSingleton = function() {
  var useStyle = styleHookSingleton();
  var Sheet = function(_a) {
    var styles = _a.styles, dynamic = _a.dynamic;
    useStyle(styles, dynamic);
    return null;
  };
  return Sheet;
};
var zeroGap = {
  left: 0,
  top: 0,
  right: 0,
  gap: 0
};
var parse = function(x) {
  return parseInt(x || "", 10) || 0;
};
var getOffset = function(gapMode) {
  var cs = window.getComputedStyle(document.body);
  var left = cs[gapMode === "padding" ? "paddingLeft" : "marginLeft"];
  var top = cs[gapMode === "padding" ? "paddingTop" : "marginTop"];
  var right = cs[gapMode === "padding" ? "paddingRight" : "marginRight"];
  return [parse(left), parse(top), parse(right)];
};
var getGapWidth = function(gapMode) {
  if (gapMode === void 0) {
    gapMode = "margin";
  }
  if (typeof window === "undefined") {
    return zeroGap;
  }
  var offsets = getOffset(gapMode);
  var documentWidth = document.documentElement.clientWidth;
  var windowWidth = window.innerWidth;
  return {
    left: offsets[0],
    top: offsets[1],
    right: offsets[2],
    gap: Math.max(0, windowWidth - documentWidth + offsets[2] - offsets[0])
  };
};
var Style = styleSingleton();
var lockAttribute = "data-scroll-locked";
var getStyles = function(_a, allowRelative, gapMode, important) {
  var left = _a.left, top = _a.top, right = _a.right, gap = _a.gap;
  if (gapMode === void 0) {
    gapMode = "margin";
  }
  return "\n  .".concat(noScrollbarsClassName, " {\n   overflow: hidden ").concat(important, ";\n   padding-right: ").concat(gap, "px ").concat(important, ";\n  }\n  body[").concat(lockAttribute, "] {\n    overflow: hidden ").concat(important, ";\n    overscroll-behavior: contain;\n    ").concat([
    allowRelative && "position: relative ".concat(important, ";"),
    gapMode === "margin" && "\n    padding-left: ".concat(left, "px;\n    padding-top: ").concat(top, "px;\n    padding-right: ").concat(right, "px;\n    margin-left:0;\n    margin-top:0;\n    margin-right: ").concat(gap, "px ").concat(important, ";\n    "),
    gapMode === "padding" && "padding-right: ".concat(gap, "px ").concat(important, ";")
  ].filter(Boolean).join(""), "\n  }\n  \n  .").concat(zeroRightClassName, " {\n    right: ").concat(gap, "px ").concat(important, ";\n  }\n  \n  .").concat(fullWidthClassName, " {\n    margin-right: ").concat(gap, "px ").concat(important, ";\n  }\n  \n  .").concat(zeroRightClassName, " .").concat(zeroRightClassName, " {\n    right: 0 ").concat(important, ";\n  }\n  \n  .").concat(fullWidthClassName, " .").concat(fullWidthClassName, " {\n    margin-right: 0 ").concat(important, ";\n  }\n  \n  body[").concat(lockAttribute, "] {\n    ").concat(removedBarSizeVariable, ": ").concat(gap, "px;\n  }\n");
};
var getCurrentUseCounter = function() {
  var counter = parseInt(document.body.getAttribute(lockAttribute) || "0", 10);
  return isFinite(counter) ? counter : 0;
};
var useLockAttribute = function() {
  React.useEffect(function() {
    document.body.setAttribute(lockAttribute, (getCurrentUseCounter() + 1).toString());
    return function() {
      var newCounter = getCurrentUseCounter() - 1;
      if (newCounter <= 0) {
        document.body.removeAttribute(lockAttribute);
      } else {
        document.body.setAttribute(lockAttribute, newCounter.toString());
      }
    };
  }, []);
};
var RemoveScrollBar = function(_a) {
  var noRelative = _a.noRelative, noImportant = _a.noImportant, _b = _a.gapMode, gapMode = _b === void 0 ? "margin" : _b;
  useLockAttribute();
  var gap = React.useMemo(function() {
    return getGapWidth(gapMode);
  }, [gapMode]);
  return React.createElement(Style, { styles: getStyles(gap, !noRelative, gapMode, !noImportant ? "!important" : "") });
};
var passiveSupported = false;
if (typeof window !== "undefined") {
  try {
    var options = Object.defineProperty({}, "passive", {
      get: function() {
        passiveSupported = true;
        return true;
      }
    });
    window.addEventListener("test", options, options);
    window.removeEventListener("test", options, options);
  } catch (err) {
    passiveSupported = false;
  }
}
var nonPassive = passiveSupported ? { passive: false } : false;
var alwaysContainsScroll = function(node) {
  return node.tagName === "TEXTAREA";
};
var elementCanBeScrolled = function(node, overflow) {
  if (!(node instanceof Element)) {
    return false;
  }
  var styles = window.getComputedStyle(node);
  return (
    // not-not-scrollable
    styles[overflow] !== "hidden" && // contains scroll inside self
    !(styles.overflowY === styles.overflowX && !alwaysContainsScroll(node) && styles[overflow] === "visible")
  );
};
var elementCouldBeVScrolled = function(node) {
  return elementCanBeScrolled(node, "overflowY");
};
var elementCouldBeHScrolled = function(node) {
  return elementCanBeScrolled(node, "overflowX");
};
var locationCouldBeScrolled = function(axis, node) {
  var ownerDocument = node.ownerDocument;
  var current = node;
  do {
    if (typeof ShadowRoot !== "undefined" && current instanceof ShadowRoot) {
      current = current.host;
    }
    var isScrollable = elementCouldBeScrolled(axis, current);
    if (isScrollable) {
      var _a = getScrollVariables(axis, current), scrollHeight = _a[1], clientHeight = _a[2];
      if (scrollHeight > clientHeight) {
        return true;
      }
    }
    current = current.parentNode;
  } while (current && current !== ownerDocument.body);
  return false;
};
var getVScrollVariables = function(_a) {
  var scrollTop = _a.scrollTop, scrollHeight = _a.scrollHeight, clientHeight = _a.clientHeight;
  return [
    scrollTop,
    scrollHeight,
    clientHeight
  ];
};
var getHScrollVariables = function(_a) {
  var scrollLeft = _a.scrollLeft, scrollWidth = _a.scrollWidth, clientWidth = _a.clientWidth;
  return [
    scrollLeft,
    scrollWidth,
    clientWidth
  ];
};
var elementCouldBeScrolled = function(axis, node) {
  return axis === "v" ? elementCouldBeVScrolled(node) : elementCouldBeHScrolled(node);
};
var getScrollVariables = function(axis, node) {
  return axis === "v" ? getVScrollVariables(node) : getHScrollVariables(node);
};
var getDirectionFactor = function(axis, direction) {
  return axis === "h" && direction === "rtl" ? -1 : 1;
};
var handleScroll = function(axis, endTarget, event, sourceDelta, noOverscroll) {
  var directionFactor = getDirectionFactor(axis, window.getComputedStyle(endTarget).direction);
  var delta = directionFactor * sourceDelta;
  var target = event.target;
  var targetInLock = endTarget.contains(target);
  var shouldCancelScroll = false;
  var isDeltaPositive = delta > 0;
  var availableScroll = 0;
  var availableScrollTop = 0;
  do {
    if (!target) {
      break;
    }
    var _a = getScrollVariables(axis, target), position = _a[0], scroll_1 = _a[1], capacity = _a[2];
    var elementScroll = scroll_1 - capacity - directionFactor * position;
    if (position || elementScroll) {
      if (elementCouldBeScrolled(axis, target)) {
        availableScroll += elementScroll;
        availableScrollTop += position;
      }
    }
    var parent_1 = target.parentNode;
    target = parent_1 && parent_1.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? parent_1.host : parent_1;
  } while (
    // portaled content
    !targetInLock && target !== document.body || // self content
    targetInLock && (endTarget.contains(target) || endTarget === target)
  );
  if (isDeltaPositive && (Math.abs(availableScroll) < 1 || false)) {
    shouldCancelScroll = true;
  } else if (!isDeltaPositive && (Math.abs(availableScrollTop) < 1 || false)) {
    shouldCancelScroll = true;
  }
  return shouldCancelScroll;
};
var getTouchXY = function(event) {
  return "changedTouches" in event ? [event.changedTouches[0].clientX, event.changedTouches[0].clientY] : [0, 0];
};
var getDeltaXY = function(event) {
  return [event.deltaX, event.deltaY];
};
var extractRef = function(ref) {
  return ref && "current" in ref ? ref.current : ref;
};
var deltaCompare = function(x, y) {
  return x[0] === y[0] && x[1] === y[1];
};
var generateStyle = function(id) {
  return "\n  .block-interactivity-".concat(id, " {pointer-events: none;}\n  .allow-interactivity-").concat(id, " {pointer-events: all;}\n");
};
var idCounter = 0;
var lockStack = [];
function RemoveScrollSideCar(props) {
  var shouldPreventQueue = React.useRef([]);
  var touchStartRef = React.useRef([0, 0]);
  var activeAxis = React.useRef();
  var id = React.useState(idCounter++)[0];
  var Style2 = React.useState(styleSingleton)[0];
  var lastProps = React.useRef(props);
  React.useEffect(function() {
    lastProps.current = props;
  }, [props]);
  React.useEffect(function() {
    if (props.inert) {
      document.body.classList.add("block-interactivity-".concat(id));
      var allow_1 = __spreadArray([props.lockRef.current], (props.shards || []).map(extractRef)).filter(Boolean);
      allow_1.forEach(function(el) {
        return el.classList.add("allow-interactivity-".concat(id));
      });
      return function() {
        document.body.classList.remove("block-interactivity-".concat(id));
        allow_1.forEach(function(el) {
          return el.classList.remove("allow-interactivity-".concat(id));
        });
      };
    }
    return;
  }, [props.inert, props.lockRef.current, props.shards]);
  var shouldCancelEvent = React.useCallback(function(event, parent) {
    if ("touches" in event && event.touches.length === 2 || event.type === "wheel" && event.ctrlKey) {
      return !lastProps.current.allowPinchZoom;
    }
    var touch = getTouchXY(event);
    var touchStart = touchStartRef.current;
    var deltaX = "deltaX" in event ? event.deltaX : touchStart[0] - touch[0];
    var deltaY = "deltaY" in event ? event.deltaY : touchStart[1] - touch[1];
    var currentAxis;
    var target = event.target;
    var moveDirection = Math.abs(deltaX) > Math.abs(deltaY) ? "h" : "v";
    if ("touches" in event && moveDirection === "h" && target.type === "range") {
      return false;
    }
    var selection = window.getSelection();
    var anchorNode = selection && selection.anchorNode;
    var isTouchingSelection = anchorNode ? anchorNode === target || anchorNode.contains(target) : false;
    if (isTouchingSelection) {
      return false;
    }
    var canBeScrolledInMainDirection = locationCouldBeScrolled(moveDirection, target);
    if (!canBeScrolledInMainDirection) {
      return true;
    }
    if (canBeScrolledInMainDirection) {
      currentAxis = moveDirection;
    } else {
      currentAxis = moveDirection === "v" ? "h" : "v";
      canBeScrolledInMainDirection = locationCouldBeScrolled(moveDirection, target);
    }
    if (!canBeScrolledInMainDirection) {
      return false;
    }
    if (!activeAxis.current && "changedTouches" in event && (deltaX || deltaY)) {
      activeAxis.current = currentAxis;
    }
    if (!currentAxis) {
      return true;
    }
    var cancelingAxis = activeAxis.current || currentAxis;
    return handleScroll(cancelingAxis, parent, event, cancelingAxis === "h" ? deltaX : deltaY);
  }, []);
  var shouldPrevent = React.useCallback(function(_event) {
    var event = _event;
    if (!lockStack.length || lockStack[lockStack.length - 1] !== Style2) {
      return;
    }
    var delta = "deltaY" in event ? getDeltaXY(event) : getTouchXY(event);
    var sourceEvent = shouldPreventQueue.current.filter(function(e) {
      return e.name === event.type && (e.target === event.target || event.target === e.shadowParent) && deltaCompare(e.delta, delta);
    })[0];
    if (sourceEvent && sourceEvent.should) {
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }
    if (!sourceEvent) {
      var shardNodes = (lastProps.current.shards || []).map(extractRef).filter(Boolean).filter(function(node) {
        return node.contains(event.target);
      });
      var shouldStop = shardNodes.length > 0 ? shouldCancelEvent(event, shardNodes[0]) : !lastProps.current.noIsolation;
      if (shouldStop) {
        if (event.cancelable) {
          event.preventDefault();
        }
      }
    }
  }, []);
  var shouldCancel = React.useCallback(function(name, delta, target, should) {
    var event = { name, delta, target, should, shadowParent: getOutermostShadowParent(target) };
    shouldPreventQueue.current.push(event);
    setTimeout(function() {
      shouldPreventQueue.current = shouldPreventQueue.current.filter(function(e) {
        return e !== event;
      });
    }, 1);
  }, []);
  var scrollTouchStart = React.useCallback(function(event) {
    touchStartRef.current = getTouchXY(event);
    activeAxis.current = void 0;
  }, []);
  var scrollWheel = React.useCallback(function(event) {
    shouldCancel(event.type, getDeltaXY(event), event.target, shouldCancelEvent(event, props.lockRef.current));
  }, []);
  var scrollTouchMove = React.useCallback(function(event) {
    shouldCancel(event.type, getTouchXY(event), event.target, shouldCancelEvent(event, props.lockRef.current));
  }, []);
  React.useEffect(function() {
    lockStack.push(Style2);
    props.setCallbacks({
      onScrollCapture: scrollWheel,
      onWheelCapture: scrollWheel,
      onTouchMoveCapture: scrollTouchMove
    });
    document.addEventListener("wheel", shouldPrevent, nonPassive);
    document.addEventListener("touchmove", shouldPrevent, nonPassive);
    document.addEventListener("touchstart", scrollTouchStart, nonPassive);
    return function() {
      lockStack = lockStack.filter(function(inst) {
        return inst !== Style2;
      });
      document.removeEventListener("wheel", shouldPrevent, nonPassive);
      document.removeEventListener("touchmove", shouldPrevent, nonPassive);
      document.removeEventListener("touchstart", scrollTouchStart, nonPassive);
    };
  }, []);
  var removeScrollBar = props.removeScrollBar, inert = props.inert;
  return React.createElement(
    React.Fragment,
    null,
    inert ? React.createElement(Style2, { styles: generateStyle(id) }) : null,
    removeScrollBar ? React.createElement(RemoveScrollBar, { noRelative: props.noRelative, gapMode: props.gapMode }) : null
  );
}
function getOutermostShadowParent(node) {
  var shadowParent = null;
  while (node !== null) {
    if (node instanceof ShadowRoot) {
      shadowParent = node.host;
      node = node.host;
    }
    node = node.parentNode;
  }
  return shadowParent;
}
var SideCar = exportSidecar(effectCar, RemoveScrollSideCar);
var ReactRemoveScroll = React.forwardRef(function(props, ref) {
  return React.createElement(RemoveScroll, __assign({}, props, { ref, sideCar: SideCar }));
});
ReactRemoveScroll.classNames = RemoveScroll.classNames;
var getDefaultParent = function(originalTarget) {
  if (typeof document === "undefined") {
    return null;
  }
  var sampleTarget = Array.isArray(originalTarget) ? originalTarget[0] : originalTarget;
  return sampleTarget.ownerDocument.body;
};
var counterMap = /* @__PURE__ */ new WeakMap();
var uncontrolledNodes = /* @__PURE__ */ new WeakMap();
var markerMap = {};
var lockCount = 0;
var unwrapHost = function(node) {
  return node && (node.host || unwrapHost(node.parentNode));
};
var correctTargets = function(parent, targets) {
  return targets.map(function(target) {
    if (parent.contains(target)) {
      return target;
    }
    var correctedTarget = unwrapHost(target);
    if (correctedTarget && parent.contains(correctedTarget)) {
      return correctedTarget;
    }
    console.error("aria-hidden", target, "in not contained inside", parent, ". Doing nothing");
    return null;
  }).filter(function(x) {
    return Boolean(x);
  });
};
var applyAttributeToOthers = function(originalTarget, parentNode, markerName, controlAttribute) {
  var targets = correctTargets(parentNode, Array.isArray(originalTarget) ? originalTarget : [originalTarget]);
  if (!markerMap[markerName]) {
    markerMap[markerName] = /* @__PURE__ */ new WeakMap();
  }
  var markerCounter = markerMap[markerName];
  var hiddenNodes = [];
  var elementsToKeep = /* @__PURE__ */ new Set();
  var elementsToStop = new Set(targets);
  var keep = function(el) {
    if (!el || elementsToKeep.has(el)) {
      return;
    }
    elementsToKeep.add(el);
    keep(el.parentNode);
  };
  targets.forEach(keep);
  var deep = function(parent) {
    if (!parent || elementsToStop.has(parent)) {
      return;
    }
    Array.prototype.forEach.call(parent.children, function(node) {
      if (elementsToKeep.has(node)) {
        deep(node);
      } else {
        try {
          var attr = node.getAttribute(controlAttribute);
          var alreadyHidden = attr !== null && attr !== "false";
          var counterValue = (counterMap.get(node) || 0) + 1;
          var markerValue = (markerCounter.get(node) || 0) + 1;
          counterMap.set(node, counterValue);
          markerCounter.set(node, markerValue);
          hiddenNodes.push(node);
          if (counterValue === 1 && alreadyHidden) {
            uncontrolledNodes.set(node, true);
          }
          if (markerValue === 1) {
            node.setAttribute(markerName, "true");
          }
          if (!alreadyHidden) {
            node.setAttribute(controlAttribute, "true");
          }
        } catch (e) {
          console.error("aria-hidden: cannot operate on ", node, e);
        }
      }
    });
  };
  deep(parentNode);
  elementsToKeep.clear();
  lockCount++;
  return function() {
    hiddenNodes.forEach(function(node) {
      var counterValue = counterMap.get(node) - 1;
      var markerValue = markerCounter.get(node) - 1;
      counterMap.set(node, counterValue);
      markerCounter.set(node, markerValue);
      if (!counterValue) {
        if (!uncontrolledNodes.has(node)) {
          node.removeAttribute(controlAttribute);
        }
        uncontrolledNodes.delete(node);
      }
      if (!markerValue) {
        node.removeAttribute(markerName);
      }
    });
    lockCount--;
    if (!lockCount) {
      counterMap = /* @__PURE__ */ new WeakMap();
      counterMap = /* @__PURE__ */ new WeakMap();
      uncontrolledNodes = /* @__PURE__ */ new WeakMap();
      markerMap = {};
    }
  };
};
var hideOthers = function(originalTarget, parentNode, markerName) {
  if (markerName === void 0) {
    markerName = "data-aria-hidden";
  }
  var targets = Array.from(Array.isArray(originalTarget) ? originalTarget : [originalTarget]);
  var activeParentNode = getDefaultParent(originalTarget);
  if (!activeParentNode) {
    return function() {
      return null;
    };
  }
  targets.push.apply(targets, Array.from(activeParentNode.querySelectorAll("[aria-live], script")));
  return applyAttributeToOthers(targets, activeParentNode, markerName, "aria-hidden");
};
var DIALOG_NAME = "Dialog";
var [createDialogContext] = createContextScope(DIALOG_NAME);
var [DialogProvider, useDialogContext] = createDialogContext(DIALOG_NAME);
var Dialog$1 = (props) => {
  const {
    __scopeDialog,
    children,
    open: openProp,
    defaultOpen,
    onOpenChange,
    modal = true
  } = props;
  const triggerRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
    caller: DIALOG_NAME
  });
  return /* @__PURE__ */ jsx(
    DialogProvider,
    {
      scope: __scopeDialog,
      triggerRef,
      contentRef,
      contentId: useId(),
      titleId: useId(),
      descriptionId: useId(),
      open,
      onOpenChange: setOpen,
      onOpenToggle: React.useCallback(() => setOpen((prevOpen) => !prevOpen), [setOpen]),
      modal,
      children
    }
  );
};
Dialog$1.displayName = DIALOG_NAME;
var TRIGGER_NAME$4 = "DialogTrigger";
var DialogTrigger$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDialog, ...triggerProps } = props;
    const context = useDialogContext(TRIGGER_NAME$4, __scopeDialog);
    const composedTriggerRef = useComposedRefs(forwardedRef, context.triggerRef);
    return /* @__PURE__ */ jsx(
      Primitive.button,
      {
        type: "button",
        "aria-haspopup": "dialog",
        "aria-expanded": context.open,
        "aria-controls": context.contentId,
        "data-state": getState$2(context.open),
        ...triggerProps,
        ref: composedTriggerRef,
        onClick: composeEventHandlers(props.onClick, context.onOpenToggle)
      }
    );
  }
);
DialogTrigger$1.displayName = TRIGGER_NAME$4;
var PORTAL_NAME$2 = "DialogPortal";
var [PortalProvider$1, usePortalContext$1] = createDialogContext(PORTAL_NAME$2, {
  forceMount: void 0
});
var DialogPortal$1 = (props) => {
  const { __scopeDialog, forceMount, children, container } = props;
  const context = useDialogContext(PORTAL_NAME$2, __scopeDialog);
  return /* @__PURE__ */ jsx(PortalProvider$1, { scope: __scopeDialog, forceMount, children: React.Children.map(children, (child) => /* @__PURE__ */ jsx(Presence, { present: forceMount || context.open, children: /* @__PURE__ */ jsx(Portal$3, { asChild: true, container, children: child }) })) });
};
DialogPortal$1.displayName = PORTAL_NAME$2;
var OVERLAY_NAME = "DialogOverlay";
var DialogOverlay$1 = React.forwardRef(
  (props, forwardedRef) => {
    const portalContext = usePortalContext$1(OVERLAY_NAME, props.__scopeDialog);
    const { forceMount = portalContext.forceMount, ...overlayProps } = props;
    const context = useDialogContext(OVERLAY_NAME, props.__scopeDialog);
    return context.modal ? /* @__PURE__ */ jsx(Presence, { present: forceMount || context.open, children: /* @__PURE__ */ jsx(DialogOverlayImpl, { ...overlayProps, ref: forwardedRef }) }) : null;
  }
);
DialogOverlay$1.displayName = OVERLAY_NAME;
var Slot$2 = /* @__PURE__ */ createSlot("DialogOverlay.RemoveScroll");
var DialogOverlayImpl = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDialog, ...overlayProps } = props;
    const context = useDialogContext(OVERLAY_NAME, __scopeDialog);
    return (
      // Make sure `Content` is scrollable even when it doesn't live inside `RemoveScroll`
      // ie. when `Overlay` and `Content` are siblings
      /* @__PURE__ */ jsx(ReactRemoveScroll, { as: Slot$2, allowPinchZoom: true, shards: [context.contentRef], children: /* @__PURE__ */ jsx(
        Primitive.div,
        {
          "data-state": getState$2(context.open),
          ...overlayProps,
          ref: forwardedRef,
          style: { pointerEvents: "auto", ...overlayProps.style }
        }
      ) })
    );
  }
);
var CONTENT_NAME$4 = "DialogContent";
var DialogContent$1 = React.forwardRef(
  (props, forwardedRef) => {
    const portalContext = usePortalContext$1(CONTENT_NAME$4, props.__scopeDialog);
    const { forceMount = portalContext.forceMount, ...contentProps } = props;
    const context = useDialogContext(CONTENT_NAME$4, props.__scopeDialog);
    return /* @__PURE__ */ jsx(Presence, { present: forceMount || context.open, children: context.modal ? /* @__PURE__ */ jsx(DialogContentModal, { ...contentProps, ref: forwardedRef }) : /* @__PURE__ */ jsx(DialogContentNonModal, { ...contentProps, ref: forwardedRef }) });
  }
);
DialogContent$1.displayName = CONTENT_NAME$4;
var DialogContentModal = React.forwardRef(
  (props, forwardedRef) => {
    const context = useDialogContext(CONTENT_NAME$4, props.__scopeDialog);
    const contentRef = React.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, context.contentRef, contentRef);
    React.useEffect(() => {
      const content = contentRef.current;
      if (content) return hideOthers(content);
    }, []);
    return /* @__PURE__ */ jsx(
      DialogContentImpl,
      {
        ...props,
        ref: composedRefs,
        trapFocus: context.open,
        disableOutsidePointerEvents: true,
        onCloseAutoFocus: composeEventHandlers(props.onCloseAutoFocus, (event) => {
          var _a;
          event.preventDefault();
          (_a = context.triggerRef.current) == null ? void 0 : _a.focus();
        }),
        onPointerDownOutside: composeEventHandlers(props.onPointerDownOutside, (event) => {
          const originalEvent = event.detail.originalEvent;
          const ctrlLeftClick = originalEvent.button === 0 && originalEvent.ctrlKey === true;
          const isRightClick = originalEvent.button === 2 || ctrlLeftClick;
          if (isRightClick) event.preventDefault();
        }),
        onFocusOutside: composeEventHandlers(
          props.onFocusOutside,
          (event) => event.preventDefault()
        )
      }
    );
  }
);
var DialogContentNonModal = React.forwardRef(
  (props, forwardedRef) => {
    const context = useDialogContext(CONTENT_NAME$4, props.__scopeDialog);
    const hasInteractedOutsideRef = React.useRef(false);
    const hasPointerDownOutsideRef = React.useRef(false);
    return /* @__PURE__ */ jsx(
      DialogContentImpl,
      {
        ...props,
        ref: forwardedRef,
        trapFocus: false,
        disableOutsidePointerEvents: false,
        onCloseAutoFocus: (event) => {
          var _a, _b;
          (_a = props.onCloseAutoFocus) == null ? void 0 : _a.call(props, event);
          if (!event.defaultPrevented) {
            if (!hasInteractedOutsideRef.current) (_b = context.triggerRef.current) == null ? void 0 : _b.focus();
            event.preventDefault();
          }
          hasInteractedOutsideRef.current = false;
          hasPointerDownOutsideRef.current = false;
        },
        onInteractOutside: (event) => {
          var _a, _b;
          (_a = props.onInteractOutside) == null ? void 0 : _a.call(props, event);
          if (!event.defaultPrevented) {
            hasInteractedOutsideRef.current = true;
            if (event.detail.originalEvent.type === "pointerdown") {
              hasPointerDownOutsideRef.current = true;
            }
          }
          const target = event.target;
          const targetIsTrigger = (_b = context.triggerRef.current) == null ? void 0 : _b.contains(target);
          if (targetIsTrigger) event.preventDefault();
          if (event.detail.originalEvent.type === "focusin" && hasPointerDownOutsideRef.current) {
            event.preventDefault();
          }
        }
      }
    );
  }
);
var DialogContentImpl = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDialog, trapFocus, onOpenAutoFocus, onCloseAutoFocus, ...contentProps } = props;
    const context = useDialogContext(CONTENT_NAME$4, __scopeDialog);
    const contentRef = React.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, contentRef);
    useFocusGuards();
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        FocusScope,
        {
          asChild: true,
          loop: true,
          trapped: trapFocus,
          onMountAutoFocus: onOpenAutoFocus,
          onUnmountAutoFocus: onCloseAutoFocus,
          children: /* @__PURE__ */ jsx(
            DismissableLayer,
            {
              role: "dialog",
              id: context.contentId,
              "aria-describedby": context.descriptionId,
              "aria-labelledby": context.titleId,
              "data-state": getState$2(context.open),
              ...contentProps,
              ref: composedRefs,
              onDismiss: () => context.onOpenChange(false)
            }
          )
        }
      ),
      /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(TitleWarning, { titleId: context.titleId }),
        /* @__PURE__ */ jsx(DescriptionWarning, { contentRef, descriptionId: context.descriptionId })
      ] })
    ] });
  }
);
var TITLE_NAME = "DialogTitle";
var DialogTitle$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDialog, ...titleProps } = props;
    const context = useDialogContext(TITLE_NAME, __scopeDialog);
    return /* @__PURE__ */ jsx(Primitive.h2, { id: context.titleId, ...titleProps, ref: forwardedRef });
  }
);
DialogTitle$1.displayName = TITLE_NAME;
var DESCRIPTION_NAME = "DialogDescription";
var DialogDescription$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDialog, ...descriptionProps } = props;
    const context = useDialogContext(DESCRIPTION_NAME, __scopeDialog);
    return /* @__PURE__ */ jsx(Primitive.p, { id: context.descriptionId, ...descriptionProps, ref: forwardedRef });
  }
);
DialogDescription$1.displayName = DESCRIPTION_NAME;
var CLOSE_NAME$1 = "DialogClose";
var DialogClose$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDialog, ...closeProps } = props;
    const context = useDialogContext(CLOSE_NAME$1, __scopeDialog);
    return /* @__PURE__ */ jsx(
      Primitive.button,
      {
        type: "button",
        ...closeProps,
        ref: forwardedRef,
        onClick: composeEventHandlers(props.onClick, () => context.onOpenChange(false))
      }
    );
  }
);
DialogClose$1.displayName = CLOSE_NAME$1;
function getState$2(open) {
  return open ? "open" : "closed";
}
var TITLE_WARNING_NAME = "DialogTitleWarning";
var [WarningProvider, useWarningContext] = createContext2(TITLE_WARNING_NAME, {
  contentName: CONTENT_NAME$4,
  titleName: TITLE_NAME,
  docsSlug: "dialog"
});
var TitleWarning = ({ titleId }) => {
  const titleWarningContext = useWarningContext(TITLE_WARNING_NAME);
  const MESSAGE = `\`${titleWarningContext.contentName}\` requires a \`${titleWarningContext.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${titleWarningContext.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${titleWarningContext.docsSlug}`;
  React.useEffect(() => {
    if (titleId) {
      const hasTitle = document.getElementById(titleId);
      if (!hasTitle) console.error(MESSAGE);
    }
  }, [MESSAGE, titleId]);
  return null;
};
var DESCRIPTION_WARNING_NAME = "DialogDescriptionWarning";
var DescriptionWarning = ({ contentRef, descriptionId }) => {
  const descriptionWarningContext = useWarningContext(DESCRIPTION_WARNING_NAME);
  const MESSAGE = `Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${descriptionWarningContext.contentName}}.`;
  React.useEffect(() => {
    var _a;
    const describedById = (_a = contentRef.current) == null ? void 0 : _a.getAttribute("aria-describedby");
    if (descriptionId && describedById) {
      const hasDescription = document.getElementById(descriptionId);
      if (!hasDescription) console.warn(MESSAGE);
    }
  }, [MESSAGE, contentRef, descriptionId]);
  return null;
};
var Root$2 = Dialog$1;
var Portal$2 = DialogPortal$1;
var Overlay = DialogOverlay$1;
var Content$2 = DialogContent$1;
var Title = DialogTitle$1;
var Description = DialogDescription$1;
var Close = DialogClose$1;
var N = '[cmdk-group=""]', Y = '[cmdk-group-items=""]', be = '[cmdk-group-heading=""]', le = '[cmdk-item=""]', ce = `${le}:not([aria-disabled="true"])`, Z = "cmdk-item-select", T = "data-value", Re = (r2, o, n) => W(r2, o, n), ue = React.createContext(void 0), K = () => React.useContext(ue), de = React.createContext(void 0), ee = () => React.useContext(de), fe = React.createContext(void 0), me = React.forwardRef((r2, o) => {
  let n = L(() => {
    var e, a;
    return { search: "", value: (a = (e = r2.value) != null ? e : r2.defaultValue) != null ? a : "", selectedItemId: void 0, filtered: { count: 0, items: /* @__PURE__ */ new Map(), groups: /* @__PURE__ */ new Set() } };
  }), u2 = L(() => /* @__PURE__ */ new Set()), c = L(() => /* @__PURE__ */ new Map()), d = L(() => /* @__PURE__ */ new Map()), f = L(() => /* @__PURE__ */ new Set()), p2 = pe(r2), { label: b, children: m2, value: R, onValueChange: x, filter: C, shouldFilter: S, loop: A, disablePointerSelection: ge = false, vimBindings: j = true, ...O } = r2, $2 = useId(), q = useId(), _ = useId(), I = React.useRef(null), v = ke();
  k(() => {
    if (R !== void 0) {
      let e = R.trim();
      n.current.value = e, E.emit();
    }
  }, [R]), k(() => {
    v(6, ne);
  }, []);
  let E = React.useMemo(() => ({ subscribe: (e) => (f.current.add(e), () => f.current.delete(e)), snapshot: () => n.current, setState: (e, a, s) => {
    var i, l, g, y;
    if (!Object.is(n.current[e], a)) {
      if (n.current[e] = a, e === "search") J2(), z(), v(1, W2);
      else if (e === "value") {
        if (document.activeElement.hasAttribute("cmdk-input") || document.activeElement.hasAttribute("cmdk-root")) {
          let h = document.getElementById(_);
          h ? h.focus() : (i = document.getElementById($2)) == null || i.focus();
        }
        if (v(7, () => {
          var h;
          n.current.selectedItemId = (h = M()) == null ? void 0 : h.id, E.emit();
        }), s || v(5, ne), ((l = p2.current) == null ? void 0 : l.value) !== void 0) {
          let h = a != null ? a : "";
          (y = (g = p2.current).onValueChange) == null || y.call(g, h);
          return;
        }
      }
      E.emit();
    }
  }, emit: () => {
    f.current.forEach((e) => e());
  } }), []), U2 = React.useMemo(() => ({ value: (e, a, s) => {
    var i;
    a !== ((i = d.current.get(e)) == null ? void 0 : i.value) && (d.current.set(e, { value: a, keywords: s }), n.current.filtered.items.set(e, te(a, s)), v(2, () => {
      z(), E.emit();
    }));
  }, item: (e, a) => (u2.current.add(e), a && (c.current.has(a) ? c.current.get(a).add(e) : c.current.set(a, /* @__PURE__ */ new Set([e]))), v(3, () => {
    J2(), z(), n.current.value || W2(), E.emit();
  }), () => {
    d.current.delete(e), u2.current.delete(e), n.current.filtered.items.delete(e);
    let s = M();
    v(4, () => {
      J2(), (s == null ? void 0 : s.getAttribute("id")) === e && W2(), E.emit();
    });
  }), group: (e) => (c.current.has(e) || c.current.set(e, /* @__PURE__ */ new Set()), () => {
    d.current.delete(e), c.current.delete(e);
  }), filter: () => p2.current.shouldFilter, label: b || r2["aria-label"], getDisablePointerSelection: () => p2.current.disablePointerSelection, listId: $2, inputId: _, labelId: q, listInnerRef: I }), []);
  function te(e, a) {
    var i, l;
    let s = (l = (i = p2.current) == null ? void 0 : i.filter) != null ? l : Re;
    return e ? s(e, n.current.search, a) : 0;
  }
  function z() {
    if (!n.current.search || p2.current.shouldFilter === false) return;
    let e = n.current.filtered.items, a = [];
    n.current.filtered.groups.forEach((i) => {
      let l = c.current.get(i), g = 0;
      l.forEach((y) => {
        let h = e.get(y);
        g = Math.max(h, g);
      }), a.push([i, g]);
    });
    let s = I.current;
    V().sort((i, l) => {
      var h, F;
      let g = i.getAttribute("id"), y = l.getAttribute("id");
      return ((h = e.get(y)) != null ? h : 0) - ((F = e.get(g)) != null ? F : 0);
    }).forEach((i) => {
      let l = i.closest(Y);
      l ? l.appendChild(i.parentElement === l ? i : i.closest(`${Y} > *`)) : s.appendChild(i.parentElement === s ? i : i.closest(`${Y} > *`));
    }), a.sort((i, l) => l[1] - i[1]).forEach((i) => {
      var g;
      let l = (g = I.current) == null ? void 0 : g.querySelector(`${N}[${T}="${encodeURIComponent(i[0])}"]`);
      l == null || l.parentElement.appendChild(l);
    });
  }
  function W2() {
    let e = V().find((s) => s.getAttribute("aria-disabled") !== "true"), a = e == null ? void 0 : e.getAttribute(T);
    E.setState("value", a || void 0);
  }
  function J2() {
    var a, s, i, l;
    if (!n.current.search || p2.current.shouldFilter === false) {
      n.current.filtered.count = u2.current.size;
      return;
    }
    n.current.filtered.groups = /* @__PURE__ */ new Set();
    let e = 0;
    for (let g of u2.current) {
      let y = (s = (a = d.current.get(g)) == null ? void 0 : a.value) != null ? s : "", h = (l = (i = d.current.get(g)) == null ? void 0 : i.keywords) != null ? l : [], F = te(y, h);
      n.current.filtered.items.set(g, F), F > 0 && e++;
    }
    for (let [g, y] of c.current) for (let h of y) if (n.current.filtered.items.get(h) > 0) {
      n.current.filtered.groups.add(g);
      break;
    }
    n.current.filtered.count = e;
  }
  function ne() {
    var a, s, i;
    let e = M();
    e && (((a = e.parentElement) == null ? void 0 : a.firstChild) === e && ((i = (s = e.closest(N)) == null ? void 0 : s.querySelector(be)) == null || i.scrollIntoView({ block: "nearest" })), e.scrollIntoView({ block: "nearest" }));
  }
  function M() {
    var e;
    return (e = I.current) == null ? void 0 : e.querySelector(`${le}[aria-selected="true"]`);
  }
  function V() {
    var e;
    return Array.from(((e = I.current) == null ? void 0 : e.querySelectorAll(ce)) || []);
  }
  function X2(e) {
    let s = V()[e];
    s && E.setState("value", s.getAttribute(T));
  }
  function Q(e) {
    var g;
    let a = M(), s = V(), i = s.findIndex((y) => y === a), l = s[i + e];
    (g = p2.current) != null && g.loop && (l = i + e < 0 ? s[s.length - 1] : i + e === s.length ? s[0] : s[i + e]), l && E.setState("value", l.getAttribute(T));
  }
  function re(e) {
    let a = M(), s = a == null ? void 0 : a.closest(N), i;
    for (; s && !i; ) s = e > 0 ? we(s, N) : De(s, N), i = s == null ? void 0 : s.querySelector(ce);
    i ? E.setState("value", i.getAttribute(T)) : Q(e);
  }
  let oe = () => X2(V().length - 1), ie = (e) => {
    e.preventDefault(), e.metaKey ? oe() : e.altKey ? re(1) : Q(1);
  }, se = (e) => {
    e.preventDefault(), e.metaKey ? X2(0) : e.altKey ? re(-1) : Q(-1);
  };
  return React.createElement(Primitive.div, { ref: o, tabIndex: -1, ...O, "cmdk-root": "", onKeyDown: (e) => {
    var s;
    (s = O.onKeyDown) == null || s.call(O, e);
    let a = e.nativeEvent.isComposing || e.keyCode === 229;
    if (!(e.defaultPrevented || a)) switch (e.key) {
      case "n":
      case "j": {
        j && e.ctrlKey && ie(e);
        break;
      }
      case "ArrowDown": {
        ie(e);
        break;
      }
      case "p":
      case "k": {
        j && e.ctrlKey && se(e);
        break;
      }
      case "ArrowUp": {
        se(e);
        break;
      }
      case "Home": {
        e.preventDefault(), X2(0);
        break;
      }
      case "End": {
        e.preventDefault(), oe();
        break;
      }
      case "Enter": {
        e.preventDefault();
        let i = M();
        if (i) {
          let l = new Event(Z);
          i.dispatchEvent(l);
        }
      }
    }
  } }, React.createElement("label", { "cmdk-label": "", htmlFor: U2.inputId, id: U2.labelId, style: Te }, b), B(r2, (e) => React.createElement(de.Provider, { value: E }, React.createElement(ue.Provider, { value: U2 }, e))));
}), he = React.forwardRef((r2, o) => {
  var _, I;
  let n = useId(), u2 = React.useRef(null), c = React.useContext(fe), d = K(), f = pe(r2), p2 = (I = (_ = f.current) == null ? void 0 : _.forceMount) != null ? I : c == null ? void 0 : c.forceMount;
  k(() => {
    if (!p2) return d.item(n, c == null ? void 0 : c.id);
  }, [p2]);
  let b = ve(n, u2, [r2.value, r2.children, u2], r2.keywords), m2 = ee(), R = P((v) => v.value && v.value === b.current), x = P((v) => p2 || d.filter() === false ? true : v.search ? v.filtered.items.get(n) > 0 : true);
  React.useEffect(() => {
    let v = u2.current;
    if (!(!v || r2.disabled)) return v.addEventListener(Z, C), () => v.removeEventListener(Z, C);
  }, [x, r2.onSelect, r2.disabled]);
  function C() {
    var v, E;
    S(), (E = (v = f.current).onSelect) == null || E.call(v, b.current);
  }
  function S() {
    m2.setState("value", b.current, true);
  }
  if (!x) return null;
  let { disabled: A, value: ge, onSelect: j, forceMount: O, keywords: $2, ...q } = r2;
  return React.createElement(Primitive.div, { ref: composeRefs(u2, o), ...q, id: n, "cmdk-item": "", role: "option", "aria-disabled": !!A, "aria-selected": !!R, "data-disabled": !!A, "data-selected": !!R, onPointerMove: A || d.getDisablePointerSelection() ? void 0 : S, onClick: A ? void 0 : C }, r2.children);
}), Ee = React.forwardRef((r2, o) => {
  let { heading: n, children: u2, forceMount: c, ...d } = r2, f = useId(), p2 = React.useRef(null), b = React.useRef(null), m2 = useId(), R = K(), x = P((S) => c || R.filter() === false ? true : S.search ? S.filtered.groups.has(f) : true);
  k(() => R.group(f), []), ve(f, p2, [r2.value, r2.heading, b]);
  let C = React.useMemo(() => ({ id: f, forceMount: c }), [c]);
  return React.createElement(Primitive.div, { ref: composeRefs(p2, o), ...d, "cmdk-group": "", role: "presentation", hidden: x ? void 0 : true }, n && React.createElement("div", { ref: b, "cmdk-group-heading": "", "aria-hidden": true, id: m2 }, n), B(r2, (S) => React.createElement("div", { "cmdk-group-items": "", role: "group", "aria-labelledby": n ? m2 : void 0 }, React.createElement(fe.Provider, { value: C }, S))));
}), ye = React.forwardRef((r2, o) => {
  let { alwaysRender: n, ...u2 } = r2, c = React.useRef(null), d = P((f) => !f.search);
  return !n && !d ? null : React.createElement(Primitive.div, { ref: composeRefs(c, o), ...u2, "cmdk-separator": "", role: "separator" });
}), Se = React.forwardRef((r2, o) => {
  let { onValueChange: n, ...u2 } = r2, c = r2.value != null, d = ee(), f = P((m2) => m2.search), p2 = P((m2) => m2.selectedItemId), b = K();
  return React.useEffect(() => {
    r2.value != null && d.setState("search", r2.value);
  }, [r2.value]), React.createElement(Primitive.input, { ref: o, ...u2, "cmdk-input": "", autoComplete: "off", autoCorrect: "off", spellCheck: false, "aria-autocomplete": "list", role: "combobox", "aria-expanded": true, "aria-controls": b.listId, "aria-labelledby": b.labelId, "aria-activedescendant": p2, id: b.inputId, type: "text", value: c ? r2.value : f, onChange: (m2) => {
    c || d.setState("search", m2.target.value), n == null || n(m2.target.value);
  } });
}), Ce = React.forwardRef((r2, o) => {
  let { children: n, label: u2 = "Suggestions", ...c } = r2, d = React.useRef(null), f = React.useRef(null), p2 = P((m2) => m2.selectedItemId), b = K();
  return React.useEffect(() => {
    if (f.current && d.current) {
      let m2 = f.current, R = d.current, x, C = new ResizeObserver(() => {
        x = requestAnimationFrame(() => {
          let S = m2.offsetHeight;
          R.style.setProperty("--cmdk-list-height", S.toFixed(1) + "px");
        });
      });
      return C.observe(m2), () => {
        cancelAnimationFrame(x), C.unobserve(m2);
      };
    }
  }, []), React.createElement(Primitive.div, { ref: composeRefs(d, o), ...c, "cmdk-list": "", role: "listbox", tabIndex: -1, "aria-activedescendant": p2, "aria-label": u2, id: b.listId }, B(r2, (m2) => React.createElement("div", { ref: composeRefs(f, b.listInnerRef), "cmdk-list-sizer": "" }, m2)));
}), xe = React.forwardRef((r2, o) => {
  let { open: n, onOpenChange: u2, overlayClassName: c, contentClassName: d, container: f, ...p2 } = r2;
  return React.createElement(Root$2, { open: n, onOpenChange: u2 }, React.createElement(Portal$2, { container: f }, React.createElement(Overlay, { "cmdk-overlay": "", className: c }), React.createElement(Content$2, { "aria-label": r2.label, "cmdk-dialog": "", className: d }, React.createElement(me, { ref: o, ...p2 }))));
}), Ie = React.forwardRef((r2, o) => P((u2) => u2.filtered.count === 0) ? React.createElement(Primitive.div, { ref: o, ...r2, "cmdk-empty": "", role: "presentation" }) : null), Pe = React.forwardRef((r2, o) => {
  let { progress: n, children: u2, label: c = "Loading...", ...d } = r2;
  return React.createElement(Primitive.div, { ref: o, ...d, "cmdk-loading": "", role: "progressbar", "aria-valuenow": n, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": c }, B(r2, (f) => React.createElement("div", { "aria-hidden": true }, f)));
}), _e = Object.assign(me, { List: Ce, Item: he, Input: Se, Group: Ee, Separator: ye, Dialog: xe, Empty: Ie, Loading: Pe });
function we(r2, o) {
  let n = r2.nextElementSibling;
  for (; n; ) {
    if (n.matches(o)) return n;
    n = n.nextElementSibling;
  }
}
function De(r2, o) {
  let n = r2.previousElementSibling;
  for (; n; ) {
    if (n.matches(o)) return n;
    n = n.previousElementSibling;
  }
}
function pe(r2) {
  let o = React.useRef(r2);
  return k(() => {
    o.current = r2;
  }), o;
}
var k = typeof window == "undefined" ? React.useEffect : React.useLayoutEffect;
function L(r2) {
  let o = React.useRef();
  return o.current === void 0 && (o.current = r2()), o;
}
function P(r2) {
  let o = ee(), n = () => r2(o.snapshot());
  return React.useSyncExternalStore(o.subscribe, n, n);
}
function ve(r2, o, n, u2 = []) {
  let c = React.useRef(), d = K();
  return k(() => {
    var b;
    let f = (() => {
      var m2;
      for (let R of n) {
        if (typeof R == "string") return R.trim();
        if (typeof R == "object" && "current" in R) return R.current ? (m2 = R.current.textContent) == null ? void 0 : m2.trim() : c.current;
      }
    })(), p2 = u2.map((m2) => m2.trim());
    d.value(r2, f, p2), (b = o.current) == null || b.setAttribute(T, f), c.current = f;
  }), c;
}
var ke = () => {
  let [r2, o] = React.useState(), n = L(() => /* @__PURE__ */ new Map());
  return k(() => {
    n.current.forEach((u2) => u2()), n.current = /* @__PURE__ */ new Map();
  }, [r2]), (u2, c) => {
    n.current.set(u2, c), o({});
  };
};
function Me(r2) {
  let o = r2.type;
  return typeof o == "function" ? o(r2.props) : "render" in o ? o.render(r2.props) : r2;
}
function B({ asChild: r2, children: o }, n) {
  return r2 && React.isValidElement(o) ? React.cloneElement(Me(o), { ref: o.ref }, n(o.props.children)) : n(o);
}
var Te = { position: "absolute", width: "1px", height: "1px", padding: "0", margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", borderWidth: "0" };
const sides = ["top", "right", "bottom", "left"];
const min = Math.min;
const max = Math.max;
const round = Math.round;
const floor = Math.floor;
const createCoords = (v) => ({
  x: v,
  y: v
});
const oppositeSideMap = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
const oppositeAlignmentMap = {
  start: "end",
  end: "start"
};
function clamp$1(start, value, end) {
  return max(start, min(value, end));
}
function evaluate(value, param) {
  return typeof value === "function" ? value(param) : value;
}
function getSide(placement) {
  return placement.split("-")[0];
}
function getAlignment(placement) {
  return placement.split("-")[1];
}
function getOppositeAxis(axis) {
  return axis === "x" ? "y" : "x";
}
function getAxisLength(axis) {
  return axis === "y" ? "height" : "width";
}
const yAxisSides = /* @__PURE__ */ new Set(["top", "bottom"]);
function getSideAxis(placement) {
  return yAxisSides.has(getSide(placement)) ? "y" : "x";
}
function getAlignmentAxis(placement) {
  return getOppositeAxis(getSideAxis(placement));
}
function getAlignmentSides(placement, rects, rtl) {
  if (rtl === void 0) {
    rtl = false;
  }
  const alignment = getAlignment(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const length = getAxisLength(alignmentAxis);
  let mainAlignmentSide = alignmentAxis === "x" ? alignment === (rtl ? "end" : "start") ? "right" : "left" : alignment === "start" ? "bottom" : "top";
  if (rects.reference[length] > rects.floating[length]) {
    mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
  }
  return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
}
function getExpandedPlacements(placement) {
  const oppositePlacement = getOppositePlacement(placement);
  return [getOppositeAlignmentPlacement(placement), oppositePlacement, getOppositeAlignmentPlacement(oppositePlacement)];
}
function getOppositeAlignmentPlacement(placement) {
  return placement.replace(/start|end/g, (alignment) => oppositeAlignmentMap[alignment]);
}
const lrPlacement = ["left", "right"];
const rlPlacement = ["right", "left"];
const tbPlacement = ["top", "bottom"];
const btPlacement = ["bottom", "top"];
function getSideList(side, isStart, rtl) {
  switch (side) {
    case "top":
    case "bottom":
      if (rtl) return isStart ? rlPlacement : lrPlacement;
      return isStart ? lrPlacement : rlPlacement;
    case "left":
    case "right":
      return isStart ? tbPlacement : btPlacement;
    default:
      return [];
  }
}
function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
  const alignment = getAlignment(placement);
  let list = getSideList(getSide(placement), direction === "start", rtl);
  if (alignment) {
    list = list.map((side) => side + "-" + alignment);
    if (flipAlignment) {
      list = list.concat(list.map(getOppositeAlignmentPlacement));
    }
  }
  return list;
}
function getOppositePlacement(placement) {
  return placement.replace(/left|right|bottom|top/g, (side) => oppositeSideMap[side]);
}
function expandPaddingObject(padding) {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    ...padding
  };
}
function getPaddingObject(padding) {
  return typeof padding !== "number" ? expandPaddingObject(padding) : {
    top: padding,
    right: padding,
    bottom: padding,
    left: padding
  };
}
function rectToClientRect(rect) {
  const {
    x,
    y,
    width,
    height
  } = rect;
  return {
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    x,
    y
  };
}
function computeCoordsFromPlacement(_ref, placement, rtl) {
  let {
    reference,
    floating
  } = _ref;
  const sideAxis = getSideAxis(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const alignLength = getAxisLength(alignmentAxis);
  const side = getSide(placement);
  const isVertical = sideAxis === "y";
  const commonX = reference.x + reference.width / 2 - floating.width / 2;
  const commonY = reference.y + reference.height / 2 - floating.height / 2;
  const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
  let coords;
  switch (side) {
    case "top":
      coords = {
        x: commonX,
        y: reference.y - floating.height
      };
      break;
    case "bottom":
      coords = {
        x: commonX,
        y: reference.y + reference.height
      };
      break;
    case "right":
      coords = {
        x: reference.x + reference.width,
        y: commonY
      };
      break;
    case "left":
      coords = {
        x: reference.x - floating.width,
        y: commonY
      };
      break;
    default:
      coords = {
        x: reference.x,
        y: reference.y
      };
  }
  switch (getAlignment(placement)) {
    case "start":
      coords[alignmentAxis] -= commonAlign * (rtl && isVertical ? -1 : 1);
      break;
    case "end":
      coords[alignmentAxis] += commonAlign * (rtl && isVertical ? -1 : 1);
      break;
  }
  return coords;
}
async function detectOverflow(state, options) {
  var _await$platform$isEle;
  if (options === void 0) {
    options = {};
  }
  const {
    x,
    y,
    platform: platform2,
    rects,
    elements,
    strategy
  } = state;
  const {
    boundary = "clippingAncestors",
    rootBoundary = "viewport",
    elementContext = "floating",
    altBoundary = false,
    padding = 0
  } = evaluate(options, state);
  const paddingObject = getPaddingObject(padding);
  const altContext = elementContext === "floating" ? "reference" : "floating";
  const element = elements[altBoundary ? altContext : elementContext];
  const clippingClientRect = rectToClientRect(await platform2.getClippingRect({
    element: ((_await$platform$isEle = await (platform2.isElement == null ? void 0 : platform2.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || await (platform2.getDocumentElement == null ? void 0 : platform2.getDocumentElement(elements.floating)),
    boundary,
    rootBoundary,
    strategy
  }));
  const rect = elementContext === "floating" ? {
    x,
    y,
    width: rects.floating.width,
    height: rects.floating.height
  } : rects.reference;
  const offsetParent = await (platform2.getOffsetParent == null ? void 0 : platform2.getOffsetParent(elements.floating));
  const offsetScale = await (platform2.isElement == null ? void 0 : platform2.isElement(offsetParent)) ? await (platform2.getScale == null ? void 0 : platform2.getScale(offsetParent)) || {
    x: 1,
    y: 1
  } : {
    x: 1,
    y: 1
  };
  const elementClientRect = rectToClientRect(platform2.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform2.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements,
    rect,
    offsetParent,
    strategy
  }) : rect);
  return {
    top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
    bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
    left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
    right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
  };
}
const computePosition$1 = async (reference, floating, config) => {
  const {
    placement = "bottom",
    strategy = "absolute",
    middleware = [],
    platform: platform2
  } = config;
  const validMiddleware = middleware.filter(Boolean);
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(floating));
  let rects = await platform2.getElementRects({
    reference,
    floating,
    strategy
  });
  let {
    x,
    y
  } = computeCoordsFromPlacement(rects, placement, rtl);
  let statefulPlacement = placement;
  let middlewareData = {};
  let resetCount = 0;
  for (let i = 0; i < validMiddleware.length; i++) {
    var _platform$detectOverf;
    const {
      name,
      fn
    } = validMiddleware[i];
    const {
      x: nextX,
      y: nextY,
      data,
      reset
    } = await fn({
      x,
      y,
      initialPlacement: placement,
      placement: statefulPlacement,
      strategy,
      middlewareData,
      rects,
      platform: {
        ...platform2,
        detectOverflow: (_platform$detectOverf = platform2.detectOverflow) != null ? _platform$detectOverf : detectOverflow
      },
      elements: {
        reference,
        floating
      }
    });
    x = nextX != null ? nextX : x;
    y = nextY != null ? nextY : y;
    middlewareData = {
      ...middlewareData,
      [name]: {
        ...middlewareData[name],
        ...data
      }
    };
    if (reset && resetCount <= 50) {
      resetCount++;
      if (typeof reset === "object") {
        if (reset.placement) {
          statefulPlacement = reset.placement;
        }
        if (reset.rects) {
          rects = reset.rects === true ? await platform2.getElementRects({
            reference,
            floating,
            strategy
          }) : reset.rects;
        }
        ({
          x,
          y
        } = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
      }
      i = -1;
    }
  }
  return {
    x,
    y,
    placement: statefulPlacement,
    strategy,
    middlewareData
  };
};
const arrow$3 = (options) => ({
  name: "arrow",
  options,
  async fn(state) {
    const {
      x,
      y,
      placement,
      rects,
      platform: platform2,
      elements,
      middlewareData
    } = state;
    const {
      element,
      padding = 0
    } = evaluate(options, state) || {};
    if (element == null) {
      return {};
    }
    const paddingObject = getPaddingObject(padding);
    const coords = {
      x,
      y
    };
    const axis = getAlignmentAxis(placement);
    const length = getAxisLength(axis);
    const arrowDimensions = await platform2.getDimensions(element);
    const isYAxis = axis === "y";
    const minProp = isYAxis ? "top" : "left";
    const maxProp = isYAxis ? "bottom" : "right";
    const clientProp = isYAxis ? "clientHeight" : "clientWidth";
    const endDiff = rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
    const startDiff = coords[axis] - rects.reference[axis];
    const arrowOffsetParent = await (platform2.getOffsetParent == null ? void 0 : platform2.getOffsetParent(element));
    let clientSize = arrowOffsetParent ? arrowOffsetParent[clientProp] : 0;
    if (!clientSize || !await (platform2.isElement == null ? void 0 : platform2.isElement(arrowOffsetParent))) {
      clientSize = elements.floating[clientProp] || rects.floating[length];
    }
    const centerToReference = endDiff / 2 - startDiff / 2;
    const largestPossiblePadding = clientSize / 2 - arrowDimensions[length] / 2 - 1;
    const minPadding = min(paddingObject[minProp], largestPossiblePadding);
    const maxPadding = min(paddingObject[maxProp], largestPossiblePadding);
    const min$1 = minPadding;
    const max2 = clientSize - arrowDimensions[length] - maxPadding;
    const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
    const offset2 = clamp$1(min$1, center, max2);
    const shouldAddOffset = !middlewareData.arrow && getAlignment(placement) != null && center !== offset2 && rects.reference[length] / 2 - (center < min$1 ? minPadding : maxPadding) - arrowDimensions[length] / 2 < 0;
    const alignmentOffset = shouldAddOffset ? center < min$1 ? center - min$1 : center - max2 : 0;
    return {
      [axis]: coords[axis] + alignmentOffset,
      data: {
        [axis]: offset2,
        centerOffset: center - offset2 - alignmentOffset,
        ...shouldAddOffset && {
          alignmentOffset
        }
      },
      reset: shouldAddOffset
    };
  }
});
const flip$2 = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "flip",
    options,
    async fn(state) {
      var _middlewareData$arrow, _middlewareData$flip;
      const {
        placement,
        middlewareData,
        rects,
        initialPlacement,
        platform: platform2,
        elements
      } = state;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = true,
        fallbackPlacements: specifiedFallbackPlacements,
        fallbackStrategy = "bestFit",
        fallbackAxisSideDirection = "none",
        flipAlignment = true,
        ...detectOverflowOptions
      } = evaluate(options, state);
      if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      const side = getSide(placement);
      const initialSideAxis = getSideAxis(initialPlacement);
      const isBasePlacement = getSide(initialPlacement) === initialPlacement;
      const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
      const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
      const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== "none";
      if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) {
        fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
      }
      const placements = [initialPlacement, ...fallbackPlacements];
      const overflow = await platform2.detectOverflow(state, detectOverflowOptions);
      const overflows = [];
      let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
      if (checkMainAxis) {
        overflows.push(overflow[side]);
      }
      if (checkCrossAxis) {
        const sides2 = getAlignmentSides(placement, rects, rtl);
        overflows.push(overflow[sides2[0]], overflow[sides2[1]]);
      }
      overflowsData = [...overflowsData, {
        placement,
        overflows
      }];
      if (!overflows.every((side2) => side2 <= 0)) {
        var _middlewareData$flip2, _overflowsData$filter;
        const nextIndex = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
        const nextPlacement = placements[nextIndex];
        if (nextPlacement) {
          const ignoreCrossAxisOverflow = checkCrossAxis === "alignment" ? initialSideAxis !== getSideAxis(nextPlacement) : false;
          if (!ignoreCrossAxisOverflow || // We leave the current main axis only if every placement on that axis
          // overflows the main axis.
          overflowsData.every((d) => getSideAxis(d.placement) === initialSideAxis ? d.overflows[0] > 0 : true)) {
            return {
              data: {
                index: nextIndex,
                overflows: overflowsData
              },
              reset: {
                placement: nextPlacement
              }
            };
          }
        }
        let resetPlacement = (_overflowsData$filter = overflowsData.filter((d) => d.overflows[0] <= 0).sort((a, b) => a.overflows[1] - b.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;
        if (!resetPlacement) {
          switch (fallbackStrategy) {
            case "bestFit": {
              var _overflowsData$filter2;
              const placement2 = (_overflowsData$filter2 = overflowsData.filter((d) => {
                if (hasFallbackAxisSideDirection) {
                  const currentSideAxis = getSideAxis(d.placement);
                  return currentSideAxis === initialSideAxis || // Create a bias to the `y` side axis due to horizontal
                  // reading directions favoring greater width.
                  currentSideAxis === "y";
                }
                return true;
              }).map((d) => [d.placement, d.overflows.filter((overflow2) => overflow2 > 0).reduce((acc, overflow2) => acc + overflow2, 0)]).sort((a, b) => a[1] - b[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
              if (placement2) {
                resetPlacement = placement2;
              }
              break;
            }
            case "initialPlacement":
              resetPlacement = initialPlacement;
              break;
          }
        }
        if (placement !== resetPlacement) {
          return {
            reset: {
              placement: resetPlacement
            }
          };
        }
      }
      return {};
    }
  };
};
function getSideOffsets(overflow, rect) {
  return {
    top: overflow.top - rect.height,
    right: overflow.right - rect.width,
    bottom: overflow.bottom - rect.height,
    left: overflow.left - rect.width
  };
}
function isAnySideFullyClipped(overflow) {
  return sides.some((side) => overflow[side] >= 0);
}
const hide$2 = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "hide",
    options,
    async fn(state) {
      const {
        rects,
        platform: platform2
      } = state;
      const {
        strategy = "referenceHidden",
        ...detectOverflowOptions
      } = evaluate(options, state);
      switch (strategy) {
        case "referenceHidden": {
          const overflow = await platform2.detectOverflow(state, {
            ...detectOverflowOptions,
            elementContext: "reference"
          });
          const offsets = getSideOffsets(overflow, rects.reference);
          return {
            data: {
              referenceHiddenOffsets: offsets,
              referenceHidden: isAnySideFullyClipped(offsets)
            }
          };
        }
        case "escaped": {
          const overflow = await platform2.detectOverflow(state, {
            ...detectOverflowOptions,
            altBoundary: true
          });
          const offsets = getSideOffsets(overflow, rects.floating);
          return {
            data: {
              escapedOffsets: offsets,
              escaped: isAnySideFullyClipped(offsets)
            }
          };
        }
        default: {
          return {};
        }
      }
    }
  };
};
const originSides = /* @__PURE__ */ new Set(["left", "top"]);
async function convertValueToCoords(state, options) {
  const {
    placement,
    platform: platform2,
    elements
  } = state;
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
  const side = getSide(placement);
  const alignment = getAlignment(placement);
  const isVertical = getSideAxis(placement) === "y";
  const mainAxisMulti = originSides.has(side) ? -1 : 1;
  const crossAxisMulti = rtl && isVertical ? -1 : 1;
  const rawValue = evaluate(options, state);
  let {
    mainAxis,
    crossAxis,
    alignmentAxis
  } = typeof rawValue === "number" ? {
    mainAxis: rawValue,
    crossAxis: 0,
    alignmentAxis: null
  } : {
    mainAxis: rawValue.mainAxis || 0,
    crossAxis: rawValue.crossAxis || 0,
    alignmentAxis: rawValue.alignmentAxis
  };
  if (alignment && typeof alignmentAxis === "number") {
    crossAxis = alignment === "end" ? alignmentAxis * -1 : alignmentAxis;
  }
  return isVertical ? {
    x: crossAxis * crossAxisMulti,
    y: mainAxis * mainAxisMulti
  } : {
    x: mainAxis * mainAxisMulti,
    y: crossAxis * crossAxisMulti
  };
}
const offset$2 = function(options) {
  if (options === void 0) {
    options = 0;
  }
  return {
    name: "offset",
    options,
    async fn(state) {
      var _middlewareData$offse, _middlewareData$arrow;
      const {
        x,
        y,
        placement,
        middlewareData
      } = state;
      const diffCoords = await convertValueToCoords(state, options);
      if (placement === ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse.placement) && (_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      return {
        x: x + diffCoords.x,
        y: y + diffCoords.y,
        data: {
          ...diffCoords,
          placement
        }
      };
    }
  };
};
const shift$2 = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "shift",
    options,
    async fn(state) {
      const {
        x,
        y,
        placement,
        platform: platform2
      } = state;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = false,
        limiter = {
          fn: (_ref) => {
            let {
              x: x2,
              y: y2
            } = _ref;
            return {
              x: x2,
              y: y2
            };
          }
        },
        ...detectOverflowOptions
      } = evaluate(options, state);
      const coords = {
        x,
        y
      };
      const overflow = await platform2.detectOverflow(state, detectOverflowOptions);
      const crossAxis = getSideAxis(getSide(placement));
      const mainAxis = getOppositeAxis(crossAxis);
      let mainAxisCoord = coords[mainAxis];
      let crossAxisCoord = coords[crossAxis];
      if (checkMainAxis) {
        const minSide = mainAxis === "y" ? "top" : "left";
        const maxSide = mainAxis === "y" ? "bottom" : "right";
        const min2 = mainAxisCoord + overflow[minSide];
        const max2 = mainAxisCoord - overflow[maxSide];
        mainAxisCoord = clamp$1(min2, mainAxisCoord, max2);
      }
      if (checkCrossAxis) {
        const minSide = crossAxis === "y" ? "top" : "left";
        const maxSide = crossAxis === "y" ? "bottom" : "right";
        const min2 = crossAxisCoord + overflow[minSide];
        const max2 = crossAxisCoord - overflow[maxSide];
        crossAxisCoord = clamp$1(min2, crossAxisCoord, max2);
      }
      const limitedCoords = limiter.fn({
        ...state,
        [mainAxis]: mainAxisCoord,
        [crossAxis]: crossAxisCoord
      });
      return {
        ...limitedCoords,
        data: {
          x: limitedCoords.x - x,
          y: limitedCoords.y - y,
          enabled: {
            [mainAxis]: checkMainAxis,
            [crossAxis]: checkCrossAxis
          }
        }
      };
    }
  };
};
const limitShift$2 = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    options,
    fn(state) {
      const {
        x,
        y,
        placement,
        rects,
        middlewareData
      } = state;
      const {
        offset: offset2 = 0,
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = true
      } = evaluate(options, state);
      const coords = {
        x,
        y
      };
      const crossAxis = getSideAxis(placement);
      const mainAxis = getOppositeAxis(crossAxis);
      let mainAxisCoord = coords[mainAxis];
      let crossAxisCoord = coords[crossAxis];
      const rawOffset = evaluate(offset2, state);
      const computedOffset = typeof rawOffset === "number" ? {
        mainAxis: rawOffset,
        crossAxis: 0
      } : {
        mainAxis: 0,
        crossAxis: 0,
        ...rawOffset
      };
      if (checkMainAxis) {
        const len = mainAxis === "y" ? "height" : "width";
        const limitMin = rects.reference[mainAxis] - rects.floating[len] + computedOffset.mainAxis;
        const limitMax = rects.reference[mainAxis] + rects.reference[len] - computedOffset.mainAxis;
        if (mainAxisCoord < limitMin) {
          mainAxisCoord = limitMin;
        } else if (mainAxisCoord > limitMax) {
          mainAxisCoord = limitMax;
        }
      }
      if (checkCrossAxis) {
        var _middlewareData$offse, _middlewareData$offse2;
        const len = mainAxis === "y" ? "width" : "height";
        const isOriginSide = originSides.has(getSide(placement));
        const limitMin = rects.reference[crossAxis] - rects.floating[len] + (isOriginSide ? ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse[crossAxis]) || 0 : 0) + (isOriginSide ? 0 : computedOffset.crossAxis);
        const limitMax = rects.reference[crossAxis] + rects.reference[len] + (isOriginSide ? 0 : ((_middlewareData$offse2 = middlewareData.offset) == null ? void 0 : _middlewareData$offse2[crossAxis]) || 0) - (isOriginSide ? computedOffset.crossAxis : 0);
        if (crossAxisCoord < limitMin) {
          crossAxisCoord = limitMin;
        } else if (crossAxisCoord > limitMax) {
          crossAxisCoord = limitMax;
        }
      }
      return {
        [mainAxis]: mainAxisCoord,
        [crossAxis]: crossAxisCoord
      };
    }
  };
};
const size$2 = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "size",
    options,
    async fn(state) {
      var _state$middlewareData, _state$middlewareData2;
      const {
        placement,
        rects,
        platform: platform2,
        elements
      } = state;
      const {
        apply = () => {
        },
        ...detectOverflowOptions
      } = evaluate(options, state);
      const overflow = await platform2.detectOverflow(state, detectOverflowOptions);
      const side = getSide(placement);
      const alignment = getAlignment(placement);
      const isYAxis = getSideAxis(placement) === "y";
      const {
        width,
        height
      } = rects.floating;
      let heightSide;
      let widthSide;
      if (side === "top" || side === "bottom") {
        heightSide = side;
        widthSide = alignment === (await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating)) ? "start" : "end") ? "left" : "right";
      } else {
        widthSide = side;
        heightSide = alignment === "end" ? "top" : "bottom";
      }
      const maximumClippingHeight = height - overflow.top - overflow.bottom;
      const maximumClippingWidth = width - overflow.left - overflow.right;
      const overflowAvailableHeight = min(height - overflow[heightSide], maximumClippingHeight);
      const overflowAvailableWidth = min(width - overflow[widthSide], maximumClippingWidth);
      const noShift = !state.middlewareData.shift;
      let availableHeight = overflowAvailableHeight;
      let availableWidth = overflowAvailableWidth;
      if ((_state$middlewareData = state.middlewareData.shift) != null && _state$middlewareData.enabled.x) {
        availableWidth = maximumClippingWidth;
      }
      if ((_state$middlewareData2 = state.middlewareData.shift) != null && _state$middlewareData2.enabled.y) {
        availableHeight = maximumClippingHeight;
      }
      if (noShift && !alignment) {
        const xMin = max(overflow.left, 0);
        const xMax = max(overflow.right, 0);
        const yMin = max(overflow.top, 0);
        const yMax = max(overflow.bottom, 0);
        if (isYAxis) {
          availableWidth = width - 2 * (xMin !== 0 || xMax !== 0 ? xMin + xMax : max(overflow.left, overflow.right));
        } else {
          availableHeight = height - 2 * (yMin !== 0 || yMax !== 0 ? yMin + yMax : max(overflow.top, overflow.bottom));
        }
      }
      await apply({
        ...state,
        availableWidth,
        availableHeight
      });
      const nextDimensions = await platform2.getDimensions(elements.floating);
      if (width !== nextDimensions.width || height !== nextDimensions.height) {
        return {
          reset: {
            rects: true
          }
        };
      }
      return {};
    }
  };
};
function hasWindow() {
  return typeof window !== "undefined";
}
function getNodeName(node) {
  if (isNode(node)) {
    return (node.nodeName || "").toLowerCase();
  }
  return "#document";
}
function getWindow(node) {
  var _node$ownerDocument;
  return (node == null || (_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
}
function getDocumentElement(node) {
  var _ref;
  return (_ref = (isNode(node) ? node.ownerDocument : node.document) || window.document) == null ? void 0 : _ref.documentElement;
}
function isNode(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Node || value instanceof getWindow(value).Node;
}
function isElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Element || value instanceof getWindow(value).Element;
}
function isHTMLElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof HTMLElement || value instanceof getWindow(value).HTMLElement;
}
function isShadowRoot(value) {
  if (!hasWindow() || typeof ShadowRoot === "undefined") {
    return false;
  }
  return value instanceof ShadowRoot || value instanceof getWindow(value).ShadowRoot;
}
const invalidOverflowDisplayValues = /* @__PURE__ */ new Set(["inline", "contents"]);
function isOverflowElement(element) {
  const {
    overflow,
    overflowX,
    overflowY,
    display
  } = getComputedStyle$1(element);
  return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) && !invalidOverflowDisplayValues.has(display);
}
const tableElements = /* @__PURE__ */ new Set(["table", "td", "th"]);
function isTableElement(element) {
  return tableElements.has(getNodeName(element));
}
const topLayerSelectors = [":popover-open", ":modal"];
function isTopLayer(element) {
  return topLayerSelectors.some((selector) => {
    try {
      return element.matches(selector);
    } catch (_e2) {
      return false;
    }
  });
}
const transformProperties = ["transform", "translate", "scale", "rotate", "perspective"];
const willChangeValues = ["transform", "translate", "scale", "rotate", "perspective", "filter"];
const containValues = ["paint", "layout", "strict", "content"];
function isContainingBlock(elementOrCss) {
  const webkit = isWebKit();
  const css = isElement(elementOrCss) ? getComputedStyle$1(elementOrCss) : elementOrCss;
  return transformProperties.some((value) => css[value] ? css[value] !== "none" : false) || (css.containerType ? css.containerType !== "normal" : false) || !webkit && (css.backdropFilter ? css.backdropFilter !== "none" : false) || !webkit && (css.filter ? css.filter !== "none" : false) || willChangeValues.some((value) => (css.willChange || "").includes(value)) || containValues.some((value) => (css.contain || "").includes(value));
}
function getContainingBlock(element) {
  let currentNode = getParentNode(element);
  while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
    if (isContainingBlock(currentNode)) {
      return currentNode;
    } else if (isTopLayer(currentNode)) {
      return null;
    }
    currentNode = getParentNode(currentNode);
  }
  return null;
}
function isWebKit() {
  if (typeof CSS === "undefined" || !CSS.supports) return false;
  return CSS.supports("-webkit-backdrop-filter", "none");
}
const lastTraversableNodeNames = /* @__PURE__ */ new Set(["html", "body", "#document"]);
function isLastTraversableNode(node) {
  return lastTraversableNodeNames.has(getNodeName(node));
}
function getComputedStyle$1(element) {
  return getWindow(element).getComputedStyle(element);
}
function getNodeScroll(element) {
  if (isElement(element)) {
    return {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
  }
  return {
    scrollLeft: element.scrollX,
    scrollTop: element.scrollY
  };
}
function getParentNode(node) {
  if (getNodeName(node) === "html") {
    return node;
  }
  const result = (
    // Step into the shadow DOM of the parent of a slotted node.
    node.assignedSlot || // DOM Element detected.
    node.parentNode || // ShadowRoot detected.
    isShadowRoot(node) && node.host || // Fallback.
    getDocumentElement(node)
  );
  return isShadowRoot(result) ? result.host : result;
}
function getNearestOverflowAncestor(node) {
  const parentNode = getParentNode(node);
  if (isLastTraversableNode(parentNode)) {
    return node.ownerDocument ? node.ownerDocument.body : node.body;
  }
  if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) {
    return parentNode;
  }
  return getNearestOverflowAncestor(parentNode);
}
function getOverflowAncestors(node, list, traverseIframes) {
  var _node$ownerDocument2;
  if (list === void 0) {
    list = [];
  }
  if (traverseIframes === void 0) {
    traverseIframes = true;
  }
  const scrollableAncestor = getNearestOverflowAncestor(node);
  const isBody = scrollableAncestor === ((_node$ownerDocument2 = node.ownerDocument) == null ? void 0 : _node$ownerDocument2.body);
  const win = getWindow(scrollableAncestor);
  if (isBody) {
    const frameElement = getFrameElement(win);
    return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : [], frameElement && traverseIframes ? getOverflowAncestors(frameElement) : []);
  }
  return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor, [], traverseIframes));
}
function getFrameElement(win) {
  return win.parent && Object.getPrototypeOf(win.parent) ? win.frameElement : null;
}
function getCssDimensions(element) {
  const css = getComputedStyle$1(element);
  let width = parseFloat(css.width) || 0;
  let height = parseFloat(css.height) || 0;
  const hasOffset = isHTMLElement(element);
  const offsetWidth = hasOffset ? element.offsetWidth : width;
  const offsetHeight = hasOffset ? element.offsetHeight : height;
  const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;
  if (shouldFallback) {
    width = offsetWidth;
    height = offsetHeight;
  }
  return {
    width,
    height,
    $: shouldFallback
  };
}
function unwrapElement(element) {
  return !isElement(element) ? element.contextElement : element;
}
function getScale(element) {
  const domElement = unwrapElement(element);
  if (!isHTMLElement(domElement)) {
    return createCoords(1);
  }
  const rect = domElement.getBoundingClientRect();
  const {
    width,
    height,
    $: $2
  } = getCssDimensions(domElement);
  let x = ($2 ? round(rect.width) : rect.width) / width;
  let y = ($2 ? round(rect.height) : rect.height) / height;
  if (!x || !Number.isFinite(x)) {
    x = 1;
  }
  if (!y || !Number.isFinite(y)) {
    y = 1;
  }
  return {
    x,
    y
  };
}
const noOffsets = /* @__PURE__ */ createCoords(0);
function getVisualOffsets(element) {
  const win = getWindow(element);
  if (!isWebKit() || !win.visualViewport) {
    return noOffsets;
  }
  return {
    x: win.visualViewport.offsetLeft,
    y: win.visualViewport.offsetTop
  };
}
function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
  if (isFixed === void 0) {
    isFixed = false;
  }
  if (!floatingOffsetParent || isFixed && floatingOffsetParent !== getWindow(element)) {
    return false;
  }
  return isFixed;
}
function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
  if (includeScale === void 0) {
    includeScale = false;
  }
  if (isFixedStrategy === void 0) {
    isFixedStrategy = false;
  }
  const clientRect = element.getBoundingClientRect();
  const domElement = unwrapElement(element);
  let scale = createCoords(1);
  if (includeScale) {
    if (offsetParent) {
      if (isElement(offsetParent)) {
        scale = getScale(offsetParent);
      }
    } else {
      scale = getScale(element);
    }
  }
  const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
  let x = (clientRect.left + visualOffsets.x) / scale.x;
  let y = (clientRect.top + visualOffsets.y) / scale.y;
  let width = clientRect.width / scale.x;
  let height = clientRect.height / scale.y;
  if (domElement) {
    const win = getWindow(domElement);
    const offsetWin = offsetParent && isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
    let currentWin = win;
    let currentIFrame = getFrameElement(currentWin);
    while (currentIFrame && offsetParent && offsetWin !== currentWin) {
      const iframeScale = getScale(currentIFrame);
      const iframeRect = currentIFrame.getBoundingClientRect();
      const css = getComputedStyle$1(currentIFrame);
      const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
      const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
      x *= iframeScale.x;
      y *= iframeScale.y;
      width *= iframeScale.x;
      height *= iframeScale.y;
      x += left;
      y += top;
      currentWin = getWindow(currentIFrame);
      currentIFrame = getFrameElement(currentWin);
    }
  }
  return rectToClientRect({
    width,
    height,
    x,
    y
  });
}
function getWindowScrollBarX(element, rect) {
  const leftScroll = getNodeScroll(element).scrollLeft;
  if (!rect) {
    return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
  }
  return rect.left + leftScroll;
}
function getHTMLOffset(documentElement, scroll) {
  const htmlRect = documentElement.getBoundingClientRect();
  const x = htmlRect.left + scroll.scrollLeft - getWindowScrollBarX(documentElement, htmlRect);
  const y = htmlRect.top + scroll.scrollTop;
  return {
    x,
    y
  };
}
function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
  let {
    elements,
    rect,
    offsetParent,
    strategy
  } = _ref;
  const isFixed = strategy === "fixed";
  const documentElement = getDocumentElement(offsetParent);
  const topLayer = elements ? isTopLayer(elements.floating) : false;
  if (offsetParent === documentElement || topLayer && isFixed) {
    return rect;
  }
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  let scale = createCoords(1);
  const offsets = createCoords(0);
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isHTMLElement(offsetParent)) {
      const offsetRect = getBoundingClientRect(offsetParent);
      scale = getScale(offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  return {
    width: rect.width * scale.x,
    height: rect.height * scale.y,
    x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
    y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
  };
}
function getClientRects(element) {
  return Array.from(element.getClientRects());
}
function getDocumentRect(element) {
  const html = getDocumentElement(element);
  const scroll = getNodeScroll(element);
  const body = element.ownerDocument.body;
  const width = max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
  const height = max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
  let x = -scroll.scrollLeft + getWindowScrollBarX(element);
  const y = -scroll.scrollTop;
  if (getComputedStyle$1(body).direction === "rtl") {
    x += max(html.clientWidth, body.clientWidth) - width;
  }
  return {
    width,
    height,
    x,
    y
  };
}
const SCROLLBAR_MAX = 25;
function getViewportRect(element, strategy) {
  const win = getWindow(element);
  const html = getDocumentElement(element);
  const visualViewport = win.visualViewport;
  let width = html.clientWidth;
  let height = html.clientHeight;
  let x = 0;
  let y = 0;
  if (visualViewport) {
    width = visualViewport.width;
    height = visualViewport.height;
    const visualViewportBased = isWebKit();
    if (!visualViewportBased || visualViewportBased && strategy === "fixed") {
      x = visualViewport.offsetLeft;
      y = visualViewport.offsetTop;
    }
  }
  const windowScrollbarX = getWindowScrollBarX(html);
  if (windowScrollbarX <= 0) {
    const doc = html.ownerDocument;
    const body = doc.body;
    const bodyStyles = getComputedStyle(body);
    const bodyMarginInline = doc.compatMode === "CSS1Compat" ? parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight) || 0 : 0;
    const clippingStableScrollbarWidth = Math.abs(html.clientWidth - body.clientWidth - bodyMarginInline);
    if (clippingStableScrollbarWidth <= SCROLLBAR_MAX) {
      width -= clippingStableScrollbarWidth;
    }
  } else if (windowScrollbarX <= SCROLLBAR_MAX) {
    width += windowScrollbarX;
  }
  return {
    width,
    height,
    x,
    y
  };
}
const absoluteOrFixed = /* @__PURE__ */ new Set(["absolute", "fixed"]);
function getInnerBoundingClientRect(element, strategy) {
  const clientRect = getBoundingClientRect(element, true, strategy === "fixed");
  const top = clientRect.top + element.clientTop;
  const left = clientRect.left + element.clientLeft;
  const scale = isHTMLElement(element) ? getScale(element) : createCoords(1);
  const width = element.clientWidth * scale.x;
  const height = element.clientHeight * scale.y;
  const x = left * scale.x;
  const y = top * scale.y;
  return {
    width,
    height,
    x,
    y
  };
}
function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
  let rect;
  if (clippingAncestor === "viewport") {
    rect = getViewportRect(element, strategy);
  } else if (clippingAncestor === "document") {
    rect = getDocumentRect(getDocumentElement(element));
  } else if (isElement(clippingAncestor)) {
    rect = getInnerBoundingClientRect(clippingAncestor, strategy);
  } else {
    const visualOffsets = getVisualOffsets(element);
    rect = {
      x: clippingAncestor.x - visualOffsets.x,
      y: clippingAncestor.y - visualOffsets.y,
      width: clippingAncestor.width,
      height: clippingAncestor.height
    };
  }
  return rectToClientRect(rect);
}
function hasFixedPositionAncestor(element, stopNode) {
  const parentNode = getParentNode(element);
  if (parentNode === stopNode || !isElement(parentNode) || isLastTraversableNode(parentNode)) {
    return false;
  }
  return getComputedStyle$1(parentNode).position === "fixed" || hasFixedPositionAncestor(parentNode, stopNode);
}
function getClippingElementAncestors(element, cache) {
  const cachedResult = cache.get(element);
  if (cachedResult) {
    return cachedResult;
  }
  let result = getOverflowAncestors(element, [], false).filter((el) => isElement(el) && getNodeName(el) !== "body");
  let currentContainingBlockComputedStyle = null;
  const elementIsFixed = getComputedStyle$1(element).position === "fixed";
  let currentNode = elementIsFixed ? getParentNode(element) : element;
  while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
    const computedStyle = getComputedStyle$1(currentNode);
    const currentNodeIsContaining = isContainingBlock(currentNode);
    if (!currentNodeIsContaining && computedStyle.position === "fixed") {
      currentContainingBlockComputedStyle = null;
    }
    const shouldDropCurrentNode = elementIsFixed ? !currentNodeIsContaining && !currentContainingBlockComputedStyle : !currentNodeIsContaining && computedStyle.position === "static" && !!currentContainingBlockComputedStyle && absoluteOrFixed.has(currentContainingBlockComputedStyle.position) || isOverflowElement(currentNode) && !currentNodeIsContaining && hasFixedPositionAncestor(element, currentNode);
    if (shouldDropCurrentNode) {
      result = result.filter((ancestor) => ancestor !== currentNode);
    } else {
      currentContainingBlockComputedStyle = computedStyle;
    }
    currentNode = getParentNode(currentNode);
  }
  cache.set(element, result);
  return result;
}
function getClippingRect(_ref) {
  let {
    element,
    boundary,
    rootBoundary,
    strategy
  } = _ref;
  const elementClippingAncestors = boundary === "clippingAncestors" ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary);
  const clippingAncestors = [...elementClippingAncestors, rootBoundary];
  const firstClippingAncestor = clippingAncestors[0];
  const clippingRect = clippingAncestors.reduce((accRect, clippingAncestor) => {
    const rect = getClientRectFromClippingAncestor(element, clippingAncestor, strategy);
    accRect.top = max(rect.top, accRect.top);
    accRect.right = min(rect.right, accRect.right);
    accRect.bottom = min(rect.bottom, accRect.bottom);
    accRect.left = max(rect.left, accRect.left);
    return accRect;
  }, getClientRectFromClippingAncestor(element, firstClippingAncestor, strategy));
  return {
    width: clippingRect.right - clippingRect.left,
    height: clippingRect.bottom - clippingRect.top,
    x: clippingRect.left,
    y: clippingRect.top
  };
}
function getDimensions(element) {
  const {
    width,
    height
  } = getCssDimensions(element);
  return {
    width,
    height
  };
}
function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  const documentElement = getDocumentElement(offsetParent);
  const isFixed = strategy === "fixed";
  const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  const offsets = createCoords(0);
  function setLeftRTLScrollbarOffset() {
    offsets.x = getWindowScrollBarX(documentElement);
  }
  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    } else if (documentElement) {
      setLeftRTLScrollbarOffset();
    }
  }
  if (isFixed && !isOffsetParentAnElement && documentElement) {
    setLeftRTLScrollbarOffset();
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  const x = rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x;
  const y = rect.top + scroll.scrollTop - offsets.y - htmlOffset.y;
  return {
    x,
    y,
    width: rect.width,
    height: rect.height
  };
}
function isStaticPositioned(element) {
  return getComputedStyle$1(element).position === "static";
}
function getTrueOffsetParent(element, polyfill) {
  if (!isHTMLElement(element) || getComputedStyle$1(element).position === "fixed") {
    return null;
  }
  if (polyfill) {
    return polyfill(element);
  }
  let rawOffsetParent = element.offsetParent;
  if (getDocumentElement(element) === rawOffsetParent) {
    rawOffsetParent = rawOffsetParent.ownerDocument.body;
  }
  return rawOffsetParent;
}
function getOffsetParent(element, polyfill) {
  const win = getWindow(element);
  if (isTopLayer(element)) {
    return win;
  }
  if (!isHTMLElement(element)) {
    let svgOffsetParent = getParentNode(element);
    while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
      if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) {
        return svgOffsetParent;
      }
      svgOffsetParent = getParentNode(svgOffsetParent);
    }
    return win;
  }
  let offsetParent = getTrueOffsetParent(element, polyfill);
  while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) {
    offsetParent = getTrueOffsetParent(offsetParent, polyfill);
  }
  if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) {
    return win;
  }
  return offsetParent || getContainingBlock(element) || win;
}
const getElementRects = async function(data) {
  const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
  const getDimensionsFn = this.getDimensions;
  const floatingDimensions = await getDimensionsFn(data.floating);
  return {
    reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
    floating: {
      x: 0,
      y: 0,
      width: floatingDimensions.width,
      height: floatingDimensions.height
    }
  };
};
function isRTL(element) {
  return getComputedStyle$1(element).direction === "rtl";
}
const platform = {
  convertOffsetParentRelativeRectToViewportRelativeRect,
  getDocumentElement,
  getClippingRect,
  getOffsetParent,
  getElementRects,
  getClientRects,
  getDimensions,
  getScale,
  isElement,
  isRTL
};
function rectsAreEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
function observeMove(element, onMove) {
  let io = null;
  let timeoutId;
  const root = getDocumentElement(element);
  function cleanup() {
    var _io;
    clearTimeout(timeoutId);
    (_io = io) == null || _io.disconnect();
    io = null;
  }
  function refresh(skip, threshold) {
    if (skip === void 0) {
      skip = false;
    }
    if (threshold === void 0) {
      threshold = 1;
    }
    cleanup();
    const elementRectForRootMargin = element.getBoundingClientRect();
    const {
      left,
      top,
      width,
      height
    } = elementRectForRootMargin;
    if (!skip) {
      onMove();
    }
    if (!width || !height) {
      return;
    }
    const insetTop = floor(top);
    const insetRight = floor(root.clientWidth - (left + width));
    const insetBottom = floor(root.clientHeight - (top + height));
    const insetLeft = floor(left);
    const rootMargin = -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px";
    const options = {
      rootMargin,
      threshold: max(0, min(1, threshold)) || 1
    };
    let isFirstUpdate = true;
    function handleObserve(entries) {
      const ratio = entries[0].intersectionRatio;
      if (ratio !== threshold) {
        if (!isFirstUpdate) {
          return refresh();
        }
        if (!ratio) {
          timeoutId = setTimeout(() => {
            refresh(false, 1e-7);
          }, 1e3);
        } else {
          refresh(false, ratio);
        }
      }
      if (ratio === 1 && !rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) {
        refresh();
      }
      isFirstUpdate = false;
    }
    try {
      io = new IntersectionObserver(handleObserve, {
        ...options,
        // Handle <iframe>s
        root: root.ownerDocument
      });
    } catch (_e2) {
      io = new IntersectionObserver(handleObserve, options);
    }
    io.observe(element);
  }
  refresh(true);
  return cleanup;
}
function autoUpdate(reference, floating, update, options) {
  if (options === void 0) {
    options = {};
  }
  const {
    ancestorScroll = true,
    ancestorResize = true,
    elementResize = typeof ResizeObserver === "function",
    layoutShift = typeof IntersectionObserver === "function",
    animationFrame = false
  } = options;
  const referenceEl = unwrapElement(reference);
  const ancestors = ancestorScroll || ancestorResize ? [...referenceEl ? getOverflowAncestors(referenceEl) : [], ...getOverflowAncestors(floating)] : [];
  ancestors.forEach((ancestor) => {
    ancestorScroll && ancestor.addEventListener("scroll", update, {
      passive: true
    });
    ancestorResize && ancestor.addEventListener("resize", update);
  });
  const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update) : null;
  let reobserveFrame = -1;
  let resizeObserver = null;
  if (elementResize) {
    resizeObserver = new ResizeObserver((_ref) => {
      let [firstEntry] = _ref;
      if (firstEntry && firstEntry.target === referenceEl && resizeObserver) {
        resizeObserver.unobserve(floating);
        cancelAnimationFrame(reobserveFrame);
        reobserveFrame = requestAnimationFrame(() => {
          var _resizeObserver;
          (_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
        });
      }
      update();
    });
    if (referenceEl && !animationFrame) {
      resizeObserver.observe(referenceEl);
    }
    resizeObserver.observe(floating);
  }
  let frameId;
  let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
  if (animationFrame) {
    frameLoop();
  }
  function frameLoop() {
    const nextRefRect = getBoundingClientRect(reference);
    if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) {
      update();
    }
    prevRefRect = nextRefRect;
    frameId = requestAnimationFrame(frameLoop);
  }
  update();
  return () => {
    var _resizeObserver2;
    ancestors.forEach((ancestor) => {
      ancestorScroll && ancestor.removeEventListener("scroll", update);
      ancestorResize && ancestor.removeEventListener("resize", update);
    });
    cleanupIo == null || cleanupIo();
    (_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
    resizeObserver = null;
    if (animationFrame) {
      cancelAnimationFrame(frameId);
    }
  };
}
const offset$1 = offset$2;
const shift$1 = shift$2;
const flip$1 = flip$2;
const size$1 = size$2;
const hide$1 = hide$2;
const arrow$2 = arrow$3;
const limitShift$1 = limitShift$2;
const computePosition = (reference, floating, options) => {
  const cache = /* @__PURE__ */ new Map();
  const mergedOptions = {
    platform,
    ...options
  };
  const platformWithCache = {
    ...mergedOptions.platform,
    _c: cache
  };
  return computePosition$1(reference, floating, {
    ...mergedOptions,
    platform: platformWithCache
  });
};
var isClient = typeof document !== "undefined";
var noop = function noop2() {
};
var index = isClient ? useLayoutEffect : noop;
function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a === "function" && a.toString() === b.toString()) {
    return true;
  }
  let length;
  let i;
  let keys;
  if (a && b && typeof a === "object") {
    if (Array.isArray(a)) {
      length = a.length;
      if (length !== b.length) return false;
      for (i = length; i-- !== 0; ) {
        if (!deepEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }
    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) {
      return false;
    }
    for (i = length; i-- !== 0; ) {
      if (!{}.hasOwnProperty.call(b, keys[i])) {
        return false;
      }
    }
    for (i = length; i-- !== 0; ) {
      const key = keys[i];
      if (key === "_owner" && a.$$typeof) {
        continue;
      }
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
  return a !== a && b !== b;
}
function getDPR(element) {
  if (typeof window === "undefined") {
    return 1;
  }
  const win = element.ownerDocument.defaultView || window;
  return win.devicePixelRatio || 1;
}
function roundByDPR(element, value) {
  const dpr = getDPR(element);
  return Math.round(value * dpr) / dpr;
}
function useLatestRef(value) {
  const ref = React.useRef(value);
  index(() => {
    ref.current = value;
  });
  return ref;
}
function useFloating(options) {
  if (options === void 0) {
    options = {};
  }
  const {
    placement = "bottom",
    strategy = "absolute",
    middleware = [],
    platform: platform2,
    elements: {
      reference: externalReference,
      floating: externalFloating
    } = {},
    transform = true,
    whileElementsMounted,
    open
  } = options;
  const [data, setData] = React.useState({
    x: 0,
    y: 0,
    strategy,
    placement,
    middlewareData: {},
    isPositioned: false
  });
  const [latestMiddleware, setLatestMiddleware] = React.useState(middleware);
  if (!deepEqual(latestMiddleware, middleware)) {
    setLatestMiddleware(middleware);
  }
  const [_reference, _setReference] = React.useState(null);
  const [_floating, _setFloating] = React.useState(null);
  const setReference = React.useCallback((node) => {
    if (node !== referenceRef.current) {
      referenceRef.current = node;
      _setReference(node);
    }
  }, []);
  const setFloating = React.useCallback((node) => {
    if (node !== floatingRef.current) {
      floatingRef.current = node;
      _setFloating(node);
    }
  }, []);
  const referenceEl = externalReference || _reference;
  const floatingEl = externalFloating || _floating;
  const referenceRef = React.useRef(null);
  const floatingRef = React.useRef(null);
  const dataRef = React.useRef(data);
  const hasWhileElementsMounted = whileElementsMounted != null;
  const whileElementsMountedRef = useLatestRef(whileElementsMounted);
  const platformRef = useLatestRef(platform2);
  const openRef = useLatestRef(open);
  const update = React.useCallback(() => {
    if (!referenceRef.current || !floatingRef.current) {
      return;
    }
    const config = {
      placement,
      strategy,
      middleware: latestMiddleware
    };
    if (platformRef.current) {
      config.platform = platformRef.current;
    }
    computePosition(referenceRef.current, floatingRef.current, config).then((data2) => {
      const fullData = {
        ...data2,
        // The floating element's position may be recomputed while it's closed
        // but still mounted (such as when transitioning out). To ensure
        // `isPositioned` will be `false` initially on the next open, avoid
        // setting it to `true` when `open === false` (must be specified).
        isPositioned: openRef.current !== false
      };
      if (isMountedRef.current && !deepEqual(dataRef.current, fullData)) {
        dataRef.current = fullData;
        ReactDOM.flushSync(() => {
          setData(fullData);
        });
      }
    });
  }, [latestMiddleware, placement, strategy, platformRef, openRef]);
  index(() => {
    if (open === false && dataRef.current.isPositioned) {
      dataRef.current.isPositioned = false;
      setData((data2) => ({
        ...data2,
        isPositioned: false
      }));
    }
  }, [open]);
  const isMountedRef = React.useRef(false);
  index(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  index(() => {
    if (referenceEl) referenceRef.current = referenceEl;
    if (floatingEl) floatingRef.current = floatingEl;
    if (referenceEl && floatingEl) {
      if (whileElementsMountedRef.current) {
        return whileElementsMountedRef.current(referenceEl, floatingEl, update);
      }
      update();
    }
  }, [referenceEl, floatingEl, update, whileElementsMountedRef, hasWhileElementsMounted]);
  const refs = React.useMemo(() => ({
    reference: referenceRef,
    floating: floatingRef,
    setReference,
    setFloating
  }), [setReference, setFloating]);
  const elements = React.useMemo(() => ({
    reference: referenceEl,
    floating: floatingEl
  }), [referenceEl, floatingEl]);
  const floatingStyles = React.useMemo(() => {
    const initialStyles = {
      position: strategy,
      left: 0,
      top: 0
    };
    if (!elements.floating) {
      return initialStyles;
    }
    const x = roundByDPR(elements.floating, data.x);
    const y = roundByDPR(elements.floating, data.y);
    if (transform) {
      return {
        ...initialStyles,
        transform: "translate(" + x + "px, " + y + "px)",
        ...getDPR(elements.floating) >= 1.5 && {
          willChange: "transform"
        }
      };
    }
    return {
      position: strategy,
      left: x,
      top: y
    };
  }, [strategy, transform, elements.floating, data.x, data.y]);
  return React.useMemo(() => ({
    ...data,
    update,
    refs,
    elements,
    floatingStyles
  }), [data, update, refs, elements, floatingStyles]);
}
const arrow$1 = (options) => {
  function isRef(value) {
    return {}.hasOwnProperty.call(value, "current");
  }
  return {
    name: "arrow",
    options,
    fn(state) {
      const {
        element,
        padding
      } = typeof options === "function" ? options(state) : options;
      if (element && isRef(element)) {
        if (element.current != null) {
          return arrow$2({
            element: element.current,
            padding
          }).fn(state);
        }
        return {};
      }
      if (element) {
        return arrow$2({
          element,
          padding
        }).fn(state);
      }
      return {};
    }
  };
};
const offset = (options, deps) => ({
  ...offset$1(options),
  options: [options, deps]
});
const shift = (options, deps) => ({
  ...shift$1(options),
  options: [options, deps]
});
const limitShift = (options, deps) => ({
  ...limitShift$1(options),
  options: [options, deps]
});
const flip = (options, deps) => ({
  ...flip$1(options),
  options: [options, deps]
});
const size = (options, deps) => ({
  ...size$1(options),
  options: [options, deps]
});
const hide = (options, deps) => ({
  ...hide$1(options),
  options: [options, deps]
});
const arrow = (options, deps) => ({
  ...arrow$1(options),
  options: [options, deps]
});
var NAME$1 = "Arrow";
var Arrow$1 = React.forwardRef((props, forwardedRef) => {
  const { children, width = 10, height = 5, ...arrowProps } = props;
  return /* @__PURE__ */ jsx(
    Primitive.svg,
    {
      ...arrowProps,
      ref: forwardedRef,
      width,
      height,
      viewBox: "0 0 30 10",
      preserveAspectRatio: "none",
      children: props.asChild ? children : /* @__PURE__ */ jsx("polygon", { points: "0,0 30,0 15,10" })
    }
  );
});
Arrow$1.displayName = NAME$1;
var Root$1 = Arrow$1;
function useSize(element) {
  const [size2, setSize] = React.useState(void 0);
  useLayoutEffect2(() => {
    if (element) {
      setSize({ width: element.offsetWidth, height: element.offsetHeight });
      const resizeObserver = new ResizeObserver((entries) => {
        if (!Array.isArray(entries)) {
          return;
        }
        if (!entries.length) {
          return;
        }
        const entry2 = entries[0];
        let width;
        let height;
        if ("borderBoxSize" in entry2) {
          const borderSizeEntry = entry2["borderBoxSize"];
          const borderSize = Array.isArray(borderSizeEntry) ? borderSizeEntry[0] : borderSizeEntry;
          width = borderSize["inlineSize"];
          height = borderSize["blockSize"];
        } else {
          width = element.offsetWidth;
          height = element.offsetHeight;
        }
        setSize({ width, height });
      });
      resizeObserver.observe(element, { box: "border-box" });
      return () => resizeObserver.unobserve(element);
    } else {
      setSize(void 0);
    }
  }, [element]);
  return size2;
}
var POPPER_NAME = "Popper";
var [createPopperContext, createPopperScope] = createContextScope(POPPER_NAME);
var [PopperProvider, usePopperContext] = createPopperContext(POPPER_NAME);
var Popper = (props) => {
  const { __scopePopper, children } = props;
  const [anchor, setAnchor] = React.useState(null);
  return /* @__PURE__ */ jsx(PopperProvider, { scope: __scopePopper, anchor, onAnchorChange: setAnchor, children });
};
Popper.displayName = POPPER_NAME;
var ANCHOR_NAME$1 = "PopperAnchor";
var PopperAnchor = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopePopper, virtualRef, ...anchorProps } = props;
    const context = usePopperContext(ANCHOR_NAME$1, __scopePopper);
    const ref = React.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    const anchorRef = React.useRef(null);
    React.useEffect(() => {
      const previousAnchor = anchorRef.current;
      anchorRef.current = (virtualRef == null ? void 0 : virtualRef.current) || ref.current;
      if (previousAnchor !== anchorRef.current) {
        context.onAnchorChange(anchorRef.current);
      }
    });
    return virtualRef ? null : /* @__PURE__ */ jsx(Primitive.div, { ...anchorProps, ref: composedRefs });
  }
);
PopperAnchor.displayName = ANCHOR_NAME$1;
var CONTENT_NAME$3 = "PopperContent";
var [PopperContentProvider, useContentContext] = createPopperContext(CONTENT_NAME$3);
var PopperContent = React.forwardRef(
  (props, forwardedRef) => {
    var _a, _b, _c, _d, _e2, _f;
    const {
      __scopePopper,
      side = "bottom",
      sideOffset = 0,
      align = "center",
      alignOffset = 0,
      arrowPadding = 0,
      avoidCollisions = true,
      collisionBoundary = [],
      collisionPadding: collisionPaddingProp = 0,
      sticky = "partial",
      hideWhenDetached = false,
      updatePositionStrategy = "optimized",
      onPlaced,
      ...contentProps
    } = props;
    const context = usePopperContext(CONTENT_NAME$3, __scopePopper);
    const [content, setContent] = React.useState(null);
    const composedRefs = useComposedRefs(forwardedRef, (node) => setContent(node));
    const [arrow$12, setArrow] = React.useState(null);
    const arrowSize = useSize(arrow$12);
    const arrowWidth = (arrowSize == null ? void 0 : arrowSize.width) ?? 0;
    const arrowHeight = (arrowSize == null ? void 0 : arrowSize.height) ?? 0;
    const desiredPlacement = side + (align !== "center" ? "-" + align : "");
    const collisionPadding = typeof collisionPaddingProp === "number" ? collisionPaddingProp : { top: 0, right: 0, bottom: 0, left: 0, ...collisionPaddingProp };
    const boundary = Array.isArray(collisionBoundary) ? collisionBoundary : [collisionBoundary];
    const hasExplicitBoundaries = boundary.length > 0;
    const detectOverflowOptions = {
      padding: collisionPadding,
      boundary: boundary.filter(isNotNull),
      // with `strategy: 'fixed'`, this is the only way to get it to respect boundaries
      altBoundary: hasExplicitBoundaries
    };
    const { refs, floatingStyles, placement, isPositioned, middlewareData } = useFloating({
      // default to `fixed` strategy so users don't have to pick and we also avoid focus scroll issues
      strategy: "fixed",
      placement: desiredPlacement,
      whileElementsMounted: (...args) => {
        const cleanup = autoUpdate(...args, {
          animationFrame: updatePositionStrategy === "always"
        });
        return cleanup;
      },
      elements: {
        reference: context.anchor
      },
      middleware: [
        offset({ mainAxis: sideOffset + arrowHeight, alignmentAxis: alignOffset }),
        avoidCollisions && shift({
          mainAxis: true,
          crossAxis: false,
          limiter: sticky === "partial" ? limitShift() : void 0,
          ...detectOverflowOptions
        }),
        avoidCollisions && flip({ ...detectOverflowOptions }),
        size({
          ...detectOverflowOptions,
          apply: ({ elements, rects, availableWidth, availableHeight }) => {
            const { width: anchorWidth, height: anchorHeight } = rects.reference;
            const contentStyle = elements.floating.style;
            contentStyle.setProperty("--radix-popper-available-width", `${availableWidth}px`);
            contentStyle.setProperty("--radix-popper-available-height", `${availableHeight}px`);
            contentStyle.setProperty("--radix-popper-anchor-width", `${anchorWidth}px`);
            contentStyle.setProperty("--radix-popper-anchor-height", `${anchorHeight}px`);
          }
        }),
        arrow$12 && arrow({ element: arrow$12, padding: arrowPadding }),
        transformOrigin({ arrowWidth, arrowHeight }),
        hideWhenDetached && hide({ strategy: "referenceHidden", ...detectOverflowOptions })
      ]
    });
    const [placedSide, placedAlign] = getSideAndAlignFromPlacement(placement);
    const handlePlaced = useCallbackRef$1(onPlaced);
    useLayoutEffect2(() => {
      if (isPositioned) {
        handlePlaced == null ? void 0 : handlePlaced();
      }
    }, [isPositioned, handlePlaced]);
    const arrowX = (_a = middlewareData.arrow) == null ? void 0 : _a.x;
    const arrowY = (_b = middlewareData.arrow) == null ? void 0 : _b.y;
    const cannotCenterArrow = ((_c = middlewareData.arrow) == null ? void 0 : _c.centerOffset) !== 0;
    const [contentZIndex, setContentZIndex] = React.useState();
    useLayoutEffect2(() => {
      if (content) setContentZIndex(window.getComputedStyle(content).zIndex);
    }, [content]);
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref: refs.setFloating,
        "data-radix-popper-content-wrapper": "",
        style: {
          ...floatingStyles,
          transform: isPositioned ? floatingStyles.transform : "translate(0, -200%)",
          // keep off the page when measuring
          minWidth: "max-content",
          zIndex: contentZIndex,
          ["--radix-popper-transform-origin"]: [
            (_d = middlewareData.transformOrigin) == null ? void 0 : _d.x,
            (_e2 = middlewareData.transformOrigin) == null ? void 0 : _e2.y
          ].join(" "),
          // hide the content if using the hide middleware and should be hidden
          // set visibility to hidden and disable pointer events so the UI behaves
          // as if the PopperContent isn't there at all
          ...((_f = middlewareData.hide) == null ? void 0 : _f.referenceHidden) && {
            visibility: "hidden",
            pointerEvents: "none"
          }
        },
        dir: props.dir,
        children: /* @__PURE__ */ jsx(
          PopperContentProvider,
          {
            scope: __scopePopper,
            placedSide,
            onArrowChange: setArrow,
            arrowX,
            arrowY,
            shouldHideArrow: cannotCenterArrow,
            children: /* @__PURE__ */ jsx(
              Primitive.div,
              {
                "data-side": placedSide,
                "data-align": placedAlign,
                ...contentProps,
                ref: composedRefs,
                style: {
                  ...contentProps.style,
                  // if the PopperContent hasn't been placed yet (not all measurements done)
                  // we prevent animations so that users's animation don't kick in too early referring wrong sides
                  animation: !isPositioned ? "none" : void 0
                }
              }
            )
          }
        )
      }
    );
  }
);
PopperContent.displayName = CONTENT_NAME$3;
var ARROW_NAME$2 = "PopperArrow";
var OPPOSITE_SIDE = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right"
};
var PopperArrow = React.forwardRef(function PopperArrow2(props, forwardedRef) {
  const { __scopePopper, ...arrowProps } = props;
  const contentContext = useContentContext(ARROW_NAME$2, __scopePopper);
  const baseSide = OPPOSITE_SIDE[contentContext.placedSide];
  return (
    // we have to use an extra wrapper because `ResizeObserver` (used by `useSize`)
    // doesn't report size as we'd expect on SVG elements.
    // it reports their bounding box which is effectively the largest path inside the SVG.
    /* @__PURE__ */ jsx(
      "span",
      {
        ref: contentContext.onArrowChange,
        style: {
          position: "absolute",
          left: contentContext.arrowX,
          top: contentContext.arrowY,
          [baseSide]: 0,
          transformOrigin: {
            top: "",
            right: "0 0",
            bottom: "center 0",
            left: "100% 0"
          }[contentContext.placedSide],
          transform: {
            top: "translateY(100%)",
            right: "translateY(50%) rotate(90deg) translateX(-50%)",
            bottom: `rotate(180deg)`,
            left: "translateY(50%) rotate(-90deg) translateX(50%)"
          }[contentContext.placedSide],
          visibility: contentContext.shouldHideArrow ? "hidden" : void 0
        },
        children: /* @__PURE__ */ jsx(
          Root$1,
          {
            ...arrowProps,
            ref: forwardedRef,
            style: {
              ...arrowProps.style,
              // ensures the element can be measured correctly (mostly for if SVG)
              display: "block"
            }
          }
        )
      }
    )
  );
});
PopperArrow.displayName = ARROW_NAME$2;
function isNotNull(value) {
  return value !== null;
}
var transformOrigin = (options) => ({
  name: "transformOrigin",
  options,
  fn(data) {
    var _a, _b, _c;
    const { placement, rects, middlewareData } = data;
    const cannotCenterArrow = ((_a = middlewareData.arrow) == null ? void 0 : _a.centerOffset) !== 0;
    const isArrowHidden = cannotCenterArrow;
    const arrowWidth = isArrowHidden ? 0 : options.arrowWidth;
    const arrowHeight = isArrowHidden ? 0 : options.arrowHeight;
    const [placedSide, placedAlign] = getSideAndAlignFromPlacement(placement);
    const noArrowAlign = { start: "0%", center: "50%", end: "100%" }[placedAlign];
    const arrowXCenter = (((_b = middlewareData.arrow) == null ? void 0 : _b.x) ?? 0) + arrowWidth / 2;
    const arrowYCenter = (((_c = middlewareData.arrow) == null ? void 0 : _c.y) ?? 0) + arrowHeight / 2;
    let x = "";
    let y = "";
    if (placedSide === "bottom") {
      x = isArrowHidden ? noArrowAlign : `${arrowXCenter}px`;
      y = `${-arrowHeight}px`;
    } else if (placedSide === "top") {
      x = isArrowHidden ? noArrowAlign : `${arrowXCenter}px`;
      y = `${rects.floating.height + arrowHeight}px`;
    } else if (placedSide === "right") {
      x = `${-arrowHeight}px`;
      y = isArrowHidden ? noArrowAlign : `${arrowYCenter}px`;
    } else if (placedSide === "left") {
      x = `${rects.floating.width + arrowHeight}px`;
      y = isArrowHidden ? noArrowAlign : `${arrowYCenter}px`;
    }
    return { data: { x, y } };
  }
});
function getSideAndAlignFromPlacement(placement) {
  const [side, align = "center"] = placement.split("-");
  return [side, align];
}
var Root2$3 = Popper;
var Anchor = PopperAnchor;
var Content$1 = PopperContent;
var Arrow = PopperArrow;
var POPOVER_NAME = "Popover";
var [createPopoverContext] = createContextScope(POPOVER_NAME, [
  createPopperScope
]);
var usePopperScope$1 = createPopperScope();
var [PopoverProvider, usePopoverContext] = createPopoverContext(POPOVER_NAME);
var Popover = (props) => {
  const {
    __scopePopover,
    children,
    open: openProp,
    defaultOpen,
    onOpenChange,
    modal = false
  } = props;
  const popperScope = usePopperScope$1(__scopePopover);
  const triggerRef = React.useRef(null);
  const [hasCustomAnchor, setHasCustomAnchor] = React.useState(false);
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
    caller: POPOVER_NAME
  });
  return /* @__PURE__ */ jsx(Root2$3, { ...popperScope, children: /* @__PURE__ */ jsx(
    PopoverProvider,
    {
      scope: __scopePopover,
      contentId: useId(),
      triggerRef,
      open,
      onOpenChange: setOpen,
      onOpenToggle: React.useCallback(() => setOpen((prevOpen) => !prevOpen), [setOpen]),
      hasCustomAnchor,
      onCustomAnchorAdd: React.useCallback(() => setHasCustomAnchor(true), []),
      onCustomAnchorRemove: React.useCallback(() => setHasCustomAnchor(false), []),
      modal,
      children
    }
  ) });
};
Popover.displayName = POPOVER_NAME;
var ANCHOR_NAME = "PopoverAnchor";
var PopoverAnchor = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopePopover, ...anchorProps } = props;
    const context = usePopoverContext(ANCHOR_NAME, __scopePopover);
    const popperScope = usePopperScope$1(__scopePopover);
    const { onCustomAnchorAdd, onCustomAnchorRemove } = context;
    React.useEffect(() => {
      onCustomAnchorAdd();
      return () => onCustomAnchorRemove();
    }, [onCustomAnchorAdd, onCustomAnchorRemove]);
    return /* @__PURE__ */ jsx(Anchor, { ...popperScope, ...anchorProps, ref: forwardedRef });
  }
);
PopoverAnchor.displayName = ANCHOR_NAME;
var TRIGGER_NAME$3 = "PopoverTrigger";
var PopoverTrigger = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopePopover, ...triggerProps } = props;
    const context = usePopoverContext(TRIGGER_NAME$3, __scopePopover);
    const popperScope = usePopperScope$1(__scopePopover);
    const composedTriggerRef = useComposedRefs(forwardedRef, context.triggerRef);
    const trigger = /* @__PURE__ */ jsx(
      Primitive.button,
      {
        type: "button",
        "aria-haspopup": "dialog",
        "aria-expanded": context.open,
        "aria-controls": context.contentId,
        "data-state": getState$1(context.open),
        ...triggerProps,
        ref: composedTriggerRef,
        onClick: composeEventHandlers(props.onClick, context.onOpenToggle)
      }
    );
    return context.hasCustomAnchor ? trigger : /* @__PURE__ */ jsx(Anchor, { asChild: true, ...popperScope, children: trigger });
  }
);
PopoverTrigger.displayName = TRIGGER_NAME$3;
var PORTAL_NAME$1 = "PopoverPortal";
var [PortalProvider, usePortalContext] = createPopoverContext(PORTAL_NAME$1, {
  forceMount: void 0
});
var PopoverPortal = (props) => {
  const { __scopePopover, forceMount, children, container } = props;
  const context = usePopoverContext(PORTAL_NAME$1, __scopePopover);
  return /* @__PURE__ */ jsx(PortalProvider, { scope: __scopePopover, forceMount, children: /* @__PURE__ */ jsx(Presence, { present: forceMount || context.open, children: /* @__PURE__ */ jsx(Portal$3, { asChild: true, container, children }) }) });
};
PopoverPortal.displayName = PORTAL_NAME$1;
var CONTENT_NAME$2 = "PopoverContent";
var PopoverContent = React.forwardRef(
  (props, forwardedRef) => {
    const portalContext = usePortalContext(CONTENT_NAME$2, props.__scopePopover);
    const { forceMount = portalContext.forceMount, ...contentProps } = props;
    const context = usePopoverContext(CONTENT_NAME$2, props.__scopePopover);
    return /* @__PURE__ */ jsx(Presence, { present: forceMount || context.open, children: context.modal ? /* @__PURE__ */ jsx(PopoverContentModal, { ...contentProps, ref: forwardedRef }) : /* @__PURE__ */ jsx(PopoverContentNonModal, { ...contentProps, ref: forwardedRef }) });
  }
);
PopoverContent.displayName = CONTENT_NAME$2;
var Slot$1 = /* @__PURE__ */ createSlot("PopoverContent.RemoveScroll");
var PopoverContentModal = React.forwardRef(
  (props, forwardedRef) => {
    const context = usePopoverContext(CONTENT_NAME$2, props.__scopePopover);
    const contentRef = React.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, contentRef);
    const isRightClickOutsideRef = React.useRef(false);
    React.useEffect(() => {
      const content = contentRef.current;
      if (content) return hideOthers(content);
    }, []);
    return /* @__PURE__ */ jsx(ReactRemoveScroll, { as: Slot$1, allowPinchZoom: true, children: /* @__PURE__ */ jsx(
      PopoverContentImpl,
      {
        ...props,
        ref: composedRefs,
        trapFocus: context.open,
        disableOutsidePointerEvents: true,
        onCloseAutoFocus: composeEventHandlers(props.onCloseAutoFocus, (event) => {
          var _a;
          event.preventDefault();
          if (!isRightClickOutsideRef.current) (_a = context.triggerRef.current) == null ? void 0 : _a.focus();
        }),
        onPointerDownOutside: composeEventHandlers(
          props.onPointerDownOutside,
          (event) => {
            const originalEvent = event.detail.originalEvent;
            const ctrlLeftClick = originalEvent.button === 0 && originalEvent.ctrlKey === true;
            const isRightClick = originalEvent.button === 2 || ctrlLeftClick;
            isRightClickOutsideRef.current = isRightClick;
          },
          { checkForDefaultPrevented: false }
        ),
        onFocusOutside: composeEventHandlers(
          props.onFocusOutside,
          (event) => event.preventDefault(),
          { checkForDefaultPrevented: false }
        )
      }
    ) });
  }
);
var PopoverContentNonModal = React.forwardRef(
  (props, forwardedRef) => {
    const context = usePopoverContext(CONTENT_NAME$2, props.__scopePopover);
    const hasInteractedOutsideRef = React.useRef(false);
    const hasPointerDownOutsideRef = React.useRef(false);
    return /* @__PURE__ */ jsx(
      PopoverContentImpl,
      {
        ...props,
        ref: forwardedRef,
        trapFocus: false,
        disableOutsidePointerEvents: false,
        onCloseAutoFocus: (event) => {
          var _a, _b;
          (_a = props.onCloseAutoFocus) == null ? void 0 : _a.call(props, event);
          if (!event.defaultPrevented) {
            if (!hasInteractedOutsideRef.current) (_b = context.triggerRef.current) == null ? void 0 : _b.focus();
            event.preventDefault();
          }
          hasInteractedOutsideRef.current = false;
          hasPointerDownOutsideRef.current = false;
        },
        onInteractOutside: (event) => {
          var _a, _b;
          (_a = props.onInteractOutside) == null ? void 0 : _a.call(props, event);
          if (!event.defaultPrevented) {
            hasInteractedOutsideRef.current = true;
            if (event.detail.originalEvent.type === "pointerdown") {
              hasPointerDownOutsideRef.current = true;
            }
          }
          const target = event.target;
          const targetIsTrigger = (_b = context.triggerRef.current) == null ? void 0 : _b.contains(target);
          if (targetIsTrigger) event.preventDefault();
          if (event.detail.originalEvent.type === "focusin" && hasPointerDownOutsideRef.current) {
            event.preventDefault();
          }
        }
      }
    );
  }
);
var PopoverContentImpl = React.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopePopover,
      trapFocus,
      onOpenAutoFocus,
      onCloseAutoFocus,
      disableOutsidePointerEvents,
      onEscapeKeyDown,
      onPointerDownOutside,
      onFocusOutside,
      onInteractOutside,
      ...contentProps
    } = props;
    const context = usePopoverContext(CONTENT_NAME$2, __scopePopover);
    const popperScope = usePopperScope$1(__scopePopover);
    useFocusGuards();
    return /* @__PURE__ */ jsx(
      FocusScope,
      {
        asChild: true,
        loop: true,
        trapped: trapFocus,
        onMountAutoFocus: onOpenAutoFocus,
        onUnmountAutoFocus: onCloseAutoFocus,
        children: /* @__PURE__ */ jsx(
          DismissableLayer,
          {
            asChild: true,
            disableOutsidePointerEvents,
            onInteractOutside,
            onEscapeKeyDown,
            onPointerDownOutside,
            onFocusOutside,
            onDismiss: () => context.onOpenChange(false),
            children: /* @__PURE__ */ jsx(
              Content$1,
              {
                "data-state": getState$1(context.open),
                role: "dialog",
                id: context.contentId,
                ...popperScope,
                ...contentProps,
                ref: forwardedRef,
                style: {
                  ...contentProps.style,
                  // re-namespace exposed content custom properties
                  ...{
                    "--radix-popover-content-transform-origin": "var(--radix-popper-transform-origin)",
                    "--radix-popover-content-available-width": "var(--radix-popper-available-width)",
                    "--radix-popover-content-available-height": "var(--radix-popper-available-height)",
                    "--radix-popover-trigger-width": "var(--radix-popper-anchor-width)",
                    "--radix-popover-trigger-height": "var(--radix-popper-anchor-height)"
                  }
                }
              }
            )
          }
        )
      }
    );
  }
);
var CLOSE_NAME = "PopoverClose";
var PopoverClose = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopePopover, ...closeProps } = props;
    const context = usePopoverContext(CLOSE_NAME, __scopePopover);
    return /* @__PURE__ */ jsx(
      Primitive.button,
      {
        type: "button",
        ...closeProps,
        ref: forwardedRef,
        onClick: composeEventHandlers(props.onClick, () => context.onOpenChange(false))
      }
    );
  }
);
PopoverClose.displayName = CLOSE_NAME;
var ARROW_NAME$1 = "PopoverArrow";
var PopoverArrow = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopePopover, ...arrowProps } = props;
    const popperScope = usePopperScope$1(__scopePopover);
    return /* @__PURE__ */ jsx(Arrow, { ...popperScope, ...arrowProps, ref: forwardedRef });
  }
);
PopoverArrow.displayName = ARROW_NAME$1;
function getState$1(open) {
  return open ? "open" : "closed";
}
var Root2$2 = Popover;
var Trigger$2 = PopoverTrigger;
var Portal$1 = PopoverPortal;
var Content2$1 = PopoverContent;
function Combobox({ options, value, onValueChange, placeholder = "Select...", searchPlaceholder = "Search...", emptyMessage = "No results found.", disabled = false, loading = false, className, clearable = false, showAllOption = true, allOptionLabel = "All" }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption ? selectedOption.count !== void 0 ? `${selectedOption.label} (${selectedOption.count})` : selectedOption.label : value === "" && showAllOption ? allOptionLabel : placeholder;
  const handleSelect = React.useCallback((selectedValue) => {
    onValueChange(selectedValue === value ? "" : selectedValue);
    setOpen(false);
    setSearch("");
  }, [onValueChange, value]);
  const handleClear = React.useCallback((e) => {
    e.stopPropagation();
    onValueChange("");
  }, [onValueChange]);
  const filterOptions = React.useCallback((optionValue, searchQuery) => {
    if (!searchQuery)
      return 1;
    const option = options.find((o) => o.value === optionValue);
    const label = (option == null ? void 0 : option.label) || optionValue;
    const lowerLabel = label.toLowerCase();
    const lowerSearch = searchQuery.toLowerCase();
    if (lowerLabel === lowerSearch)
      return 1;
    if (lowerLabel.startsWith(lowerSearch))
      return 0.9;
    if (lowerLabel.includes(lowerSearch))
      return 0.8;
    let searchIdx = 0;
    for (let i = 0; i < lowerLabel.length && searchIdx < lowerSearch.length; i++) {
      if (lowerLabel[i] === lowerSearch[searchIdx]) {
        searchIdx++;
      }
    }
    if (searchIdx === lowerSearch.length)
      return 0.6;
    return 0;
  }, [options]);
  return jsxs(Root2$2, { open, onOpenChange: setOpen, children: [jsx(Trigger$2, { asChild: true, children: jsxs("button", { type: "button", role: "combobox", "aria-expanded": open, "aria-haspopup": "listbox", disabled: disabled || loading, className: cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background", "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", "disabled:cursor-not-allowed disabled:opacity-50", className), children: [jsx("span", { className: "truncate text-left flex-1", children: loading ? "Loading..." : displayValue }), jsxs("div", { className: "flex items-center gap-1 ml-2", children: [clearable && value && !disabled && jsx("span", { role: "button", tabIndex: 0, onClick: handleClear, onKeyDown: (e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClear(e);
    }
  }, className: "rounded-sm opacity-50 hover:opacity-100 cursor-pointer", children: jsx(X$1, { className: "h-3 w-3" }) }), jsx(ChevronsUpDown, { className: "h-4 w-4 shrink-0 opacity-50" })] })] }) }), jsx(Portal$1, { children: jsx(Content2$1, { className: cn("z-50 min-w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md", "data-[state=open]:animate-in data-[state=closed]:animate-out", "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"), sideOffset: 4, align: "start", children: jsxs(_e, { filter: filterOptions, className: "w-full", children: [jsx("div", { className: "flex items-center border-b px-3", children: jsx(Se, { placeholder: searchPlaceholder, value: search, onValueChange: setSearch, className: "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50" }) }), jsxs(Ce, { className: "max-h-[300px] overflow-y-auto p-1", children: [jsx(Ie, { className: "py-6 text-center text-sm text-muted-foreground", children: emptyMessage }), jsxs(Ee, { children: [showAllOption && jsxs(he, { value: "_all", onSelect: () => handleSelect(""), className: cn("relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none", "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground", "hover:bg-accent hover:text-accent-foreground"), children: [jsx(Check, { className: cn("mr-2 h-4 w-4", value === "" ? "opacity-100" : "opacity-0") }), allOptionLabel] }), options.map((option) => jsxs(he, { value: option.value, onSelect: () => handleSelect(option.value), className: cn("relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none", "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground", "hover:bg-accent hover:text-accent-foreground"), children: [jsx(Check, { className: cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0") }), jsx("span", { className: "flex-1 truncate", children: option.label }), option.count !== void 0 && jsxs("span", { className: "ml-2 text-xs text-muted-foreground", children: ["(", option.count, ")"] })] }, option.value))] })] })] }) }) })] });
}
function usePrevious(value) {
  const ref = React.useRef({ value, previous: value });
  return React.useMemo(() => {
    if (ref.current.value !== value) {
      ref.current.previous = ref.current.value;
      ref.current.value = value;
    }
    return ref.current.previous;
  }, [value]);
}
var CHECKBOX_NAME = "Checkbox";
var [createCheckboxContext] = createContextScope(CHECKBOX_NAME);
var [CheckboxProviderImpl, useCheckboxContext] = createCheckboxContext(CHECKBOX_NAME);
function CheckboxProvider(props) {
  const {
    __scopeCheckbox,
    checked: checkedProp,
    children,
    defaultChecked,
    disabled,
    form,
    name,
    onCheckedChange,
    required,
    value = "on",
    // @ts-expect-error
    internal_do_not_use_render
  } = props;
  const [checked, setChecked] = useControllableState({
    prop: checkedProp,
    defaultProp: defaultChecked ?? false,
    onChange: onCheckedChange,
    caller: CHECKBOX_NAME
  });
  const [control, setControl] = React.useState(null);
  const [bubbleInput, setBubbleInput] = React.useState(null);
  const hasConsumerStoppedPropagationRef = React.useRef(false);
  const isFormControl = control ? !!form || !!control.closest("form") : (
    // We set this to true by default so that events bubble to forms without JS (SSR)
    true
  );
  const context = {
    checked,
    disabled,
    setChecked,
    control,
    setControl,
    name,
    form,
    value,
    hasConsumerStoppedPropagationRef,
    required,
    defaultChecked: isIndeterminate(defaultChecked) ? false : defaultChecked,
    isFormControl,
    bubbleInput,
    setBubbleInput
  };
  return /* @__PURE__ */ jsx(
    CheckboxProviderImpl,
    {
      scope: __scopeCheckbox,
      ...context,
      children: isFunction(internal_do_not_use_render) ? internal_do_not_use_render(context) : children
    }
  );
}
var TRIGGER_NAME$2 = "CheckboxTrigger";
var CheckboxTrigger = React.forwardRef(
  ({ __scopeCheckbox, onKeyDown, onClick, ...checkboxProps }, forwardedRef) => {
    const {
      control,
      value,
      disabled,
      checked,
      required,
      setControl,
      setChecked,
      hasConsumerStoppedPropagationRef,
      isFormControl,
      bubbleInput
    } = useCheckboxContext(TRIGGER_NAME$2, __scopeCheckbox);
    const composedRefs = useComposedRefs(forwardedRef, setControl);
    const initialCheckedStateRef = React.useRef(checked);
    React.useEffect(() => {
      const form = control == null ? void 0 : control.form;
      if (form) {
        const reset = () => setChecked(initialCheckedStateRef.current);
        form.addEventListener("reset", reset);
        return () => form.removeEventListener("reset", reset);
      }
    }, [control, setChecked]);
    return /* @__PURE__ */ jsx(
      Primitive.button,
      {
        type: "button",
        role: "checkbox",
        "aria-checked": isIndeterminate(checked) ? "mixed" : checked,
        "aria-required": required,
        "data-state": getState(checked),
        "data-disabled": disabled ? "" : void 0,
        disabled,
        value,
        ...checkboxProps,
        ref: composedRefs,
        onKeyDown: composeEventHandlers(onKeyDown, (event) => {
          if (event.key === "Enter") event.preventDefault();
        }),
        onClick: composeEventHandlers(onClick, (event) => {
          setChecked((prevChecked) => isIndeterminate(prevChecked) ? true : !prevChecked);
          if (bubbleInput && isFormControl) {
            hasConsumerStoppedPropagationRef.current = event.isPropagationStopped();
            if (!hasConsumerStoppedPropagationRef.current) event.stopPropagation();
          }
        })
      }
    );
  }
);
CheckboxTrigger.displayName = TRIGGER_NAME$2;
var Checkbox$1 = React.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeCheckbox,
      name,
      checked,
      defaultChecked,
      required,
      disabled,
      value,
      onCheckedChange,
      form,
      ...checkboxProps
    } = props;
    return /* @__PURE__ */ jsx(
      CheckboxProvider,
      {
        __scopeCheckbox,
        checked,
        defaultChecked,
        disabled,
        required,
        onCheckedChange,
        name,
        form,
        value,
        internal_do_not_use_render: ({ isFormControl }) => /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            CheckboxTrigger,
            {
              ...checkboxProps,
              ref: forwardedRef,
              __scopeCheckbox
            }
          ),
          isFormControl && /* @__PURE__ */ jsx(
            CheckboxBubbleInput,
            {
              __scopeCheckbox
            }
          )
        ] })
      }
    );
  }
);
Checkbox$1.displayName = CHECKBOX_NAME;
var INDICATOR_NAME = "CheckboxIndicator";
var CheckboxIndicator = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeCheckbox, forceMount, ...indicatorProps } = props;
    const context = useCheckboxContext(INDICATOR_NAME, __scopeCheckbox);
    return /* @__PURE__ */ jsx(
      Presence,
      {
        present: forceMount || isIndeterminate(context.checked) || context.checked === true,
        children: /* @__PURE__ */ jsx(
          Primitive.span,
          {
            "data-state": getState(context.checked),
            "data-disabled": context.disabled ? "" : void 0,
            ...indicatorProps,
            ref: forwardedRef,
            style: { pointerEvents: "none", ...props.style }
          }
        )
      }
    );
  }
);
CheckboxIndicator.displayName = INDICATOR_NAME;
var BUBBLE_INPUT_NAME$1 = "CheckboxBubbleInput";
var CheckboxBubbleInput = React.forwardRef(
  ({ __scopeCheckbox, ...props }, forwardedRef) => {
    const {
      control,
      hasConsumerStoppedPropagationRef,
      checked,
      defaultChecked,
      required,
      disabled,
      name,
      value,
      form,
      bubbleInput,
      setBubbleInput
    } = useCheckboxContext(BUBBLE_INPUT_NAME$1, __scopeCheckbox);
    const composedRefs = useComposedRefs(forwardedRef, setBubbleInput);
    const prevChecked = usePrevious(checked);
    const controlSize = useSize(control);
    React.useEffect(() => {
      const input = bubbleInput;
      if (!input) return;
      const inputProto = window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(
        inputProto,
        "checked"
      );
      const setChecked = descriptor.set;
      const bubbles = !hasConsumerStoppedPropagationRef.current;
      if (prevChecked !== checked && setChecked) {
        const event = new Event("click", { bubbles });
        input.indeterminate = isIndeterminate(checked);
        setChecked.call(input, isIndeterminate(checked) ? false : checked);
        input.dispatchEvent(event);
      }
    }, [bubbleInput, prevChecked, checked, hasConsumerStoppedPropagationRef]);
    const defaultCheckedRef = React.useRef(isIndeterminate(checked) ? false : checked);
    return /* @__PURE__ */ jsx(
      Primitive.input,
      {
        type: "checkbox",
        "aria-hidden": true,
        defaultChecked: defaultChecked ?? defaultCheckedRef.current,
        required,
        disabled,
        name,
        value,
        form,
        ...props,
        tabIndex: -1,
        ref: composedRefs,
        style: {
          ...props.style,
          ...controlSize,
          position: "absolute",
          pointerEvents: "none",
          opacity: 0,
          margin: 0,
          // We transform because the input is absolutely positioned but we have
          // rendered it **after** the button. This pulls it back to sit on top
          // of the button.
          transform: "translateX(-100%)"
        }
      }
    );
  }
);
CheckboxBubbleInput.displayName = BUBBLE_INPUT_NAME$1;
function isFunction(value) {
  return typeof value === "function";
}
function isIndeterminate(checked) {
  return checked === "indeterminate";
}
function getState(checked) {
  return isIndeterminate(checked) ? "indeterminate" : checked ? "checked" : "unchecked";
}
const Checkbox = React.forwardRef(({ className, ...props }, ref) => jsx(Checkbox$1, { ref, className: cn("peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground", className), ...props, children: jsx(CheckboxIndicator, { className: cn("flex items-center justify-center text-current"), children: jsx(Check, { className: "h-4 w-4" }) }) }));
Checkbox.displayName = Checkbox$1.displayName;
function TimeRangeDropdown({ presets, selectedPreset, onPresetSelect, onCustomRangeApply, customStart: initialCustomStart, customEnd: initialCustomEnd, disabled = false, className, displayLabel }) {
  const [open, setOpen] = React.useState(false);
  const [showCustomInputs, setShowCustomInputs] = React.useState(false);
  const [customStart, setCustomStart] = React.useState(initialCustomStart || "");
  const [customEnd, setCustomEnd] = React.useState(initialCustomEnd || "");
  React.useEffect(() => {
    if (initialCustomStart)
      setCustomStart(initialCustomStart);
    if (initialCustomEnd)
      setCustomEnd(initialCustomEnd);
  }, [initialCustomStart, initialCustomEnd]);
  const selectedPresetObj = presets.find((p2) => p2.key === selectedPreset);
  const label = displayLabel || (selectedPresetObj == null ? void 0 : selectedPresetObj.label) || "Select time range";
  const handlePresetClick = (presetKey) => {
    onPresetSelect(presetKey);
    setShowCustomInputs(false);
    setOpen(false);
  };
  const handleCustomClick = () => {
    setShowCustomInputs(true);
  };
  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onCustomRangeApply(customStart, customEnd);
      setShowCustomInputs(false);
      setOpen(false);
    }
  };
  const handleCustomCancel = () => {
    setShowCustomInputs(false);
  };
  return jsxs(Root2$2, { open, onOpenChange: setOpen, children: [jsx(Trigger$2, { asChild: true, children: jsxs("button", { type: "button", disabled, className: cn("flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background", "hover:bg-accent hover:text-accent-foreground", "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", "disabled:cursor-not-allowed disabled:opacity-50", className), children: [jsx(Calendar, { className: "h-4 w-4 text-muted-foreground" }), jsx("span", { className: "whitespace-nowrap", children: label }), jsx(ChevronDown, { className: "h-4 w-4 text-muted-foreground" })] }) }), jsx(Portal$1, { children: jsx(Content2$1, { className: cn("z-50 min-w-[200px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md", "data-[state=open]:animate-in data-[state=closed]:animate-out", "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"), sideOffset: 4, align: "end", children: !showCustomInputs ? jsxs("div", { className: "p-1", children: [presets.map((preset) => jsx("button", { type: "button", onClick: () => handlePresetClick(preset.key), className: cn("relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none", "hover:bg-accent hover:text-accent-foreground", selectedPreset === preset.key && "bg-accent text-accent-foreground font-medium"), children: preset.label }, preset.key)), jsx("div", { className: "my-1 h-px bg-border" }), jsx("button", { type: "button", onClick: handleCustomClick, className: cn("relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none", "hover:bg-accent hover:text-accent-foreground", selectedPreset === "custom" && "bg-accent text-accent-foreground font-medium"), children: "Custom range..." })] }) : jsxs("div", { className: "p-4 min-w-[280px]", children: [jsxs("div", { className: "flex flex-col gap-3", children: [jsxs("div", { className: "flex flex-col gap-1.5", children: [jsx(Label$1, { htmlFor: "time-range-start", className: "text-xs text-muted-foreground font-semibold uppercase tracking-tight", children: "Start" }), jsx(Input, { id: "time-range-start", type: "datetime-local", value: customStart, onChange: (e) => setCustomStart(e.target.value), className: "w-full", disabled })] }), jsxs("div", { className: "flex flex-col gap-1.5", children: [jsx(Label$1, { htmlFor: "time-range-end", className: "text-xs text-muted-foreground font-semibold uppercase tracking-tight", children: "End" }), jsx(Input, { id: "time-range-end", type: "datetime-local", value: customEnd, onChange: (e) => setCustomEnd(e.target.value), className: "w-full", disabled })] })] }), jsxs("div", { className: "flex justify-end gap-2 mt-4 pt-3 border-t border-border", children: [jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: handleCustomCancel, children: "Back" }), jsx(Button, { type: "button", size: "sm", onClick: handleCustomApply, disabled: !customStart || !customEnd, children: "Apply" })] })] }) }) })] });
}
const TIME_PRESETS$1 = [
  {
    key: "last15min",
    label: "Last 15 min",
    getValue: () => ({
      start: formatISO(subMinutes(/* @__PURE__ */ new Date())),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  },
  {
    key: "last1hour",
    label: "Last hour",
    getValue: () => ({
      start: formatISO(subHours(/* @__PURE__ */ new Date(), 1)),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  },
  {
    key: "last6hours",
    label: "Last 6 hours",
    getValue: () => ({
      start: formatISO(subHours(/* @__PURE__ */ new Date(), 6)),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  },
  {
    key: "last24hours",
    label: "Last 24 hours",
    getValue: () => ({
      start: formatISO(subHours(/* @__PURE__ */ new Date(), 24)),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  },
  {
    key: "last7days",
    label: "Last 7 days",
    getValue: () => ({
      start: formatISO(subDays(/* @__PURE__ */ new Date(), 7)),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  },
  {
    key: "last30days",
    label: "Last 30 days",
    getValue: () => ({
      start: formatISO(subDays(/* @__PURE__ */ new Date(), 30)),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  }
];
const DEBOUNCE_DELAY = 300;
const formatDatetimeLocal$2 = (isoString) => {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};
function SimpleQueryBuilder({ client, onFilterChange, initialLimit = 100, className = "", disabled = false }) {
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  const [filters, setFilters] = useState({
    verb: "",
    resourceType: "",
    namespace: "",
    resourceName: "",
    username: ""
  });
  const [limit, setLimit] = useState(initialLimit);
  const [advancedFilter, setAdvancedFilter] = useState("");
  const [useAdvancedFilter, setUseAdvancedFilter] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("last24hours");
  const [timeRange, setTimeRange] = useState(null);
  const [customStart, setCustomStart] = useState(() => formatDatetimeLocal$2(formatISO(subDays(/* @__PURE__ */ new Date(), 1))));
  const [customEnd, setCustomEnd] = useState(() => formatDatetimeLocal$2(formatISO(/* @__PURE__ */ new Date())));
  const { verbs, resources, namespaces, usernames, isLoading: facetsLoading, error: facetsError } = useAuditLogFacets(client, timeRange);
  if (facetsError) {
    console.error("Failed to load audit log facets:", facetsError);
  }
  const debounceTimerRef = useRef(null);
  const isInitialMount = useRef(true);
  useEffect(() => {
    var _a;
    const defaultRange = (_a = TIME_PRESETS$1.find((p2) => p2.key === "last24hours")) == null ? void 0 : _a.getValue();
    if (defaultRange) {
      setTimeRange(defaultRange);
    }
  }, []);
  const generateCEL = useCallback(() => {
    const parts = [];
    if (filters.verb) {
      parts.push(`verb == "${filters.verb}"`);
    }
    if (filters.resourceType) {
      parts.push(`objectRef.resource == "${filters.resourceType}"`);
    }
    if (filters.namespace) {
      parts.push(`objectRef.namespace == "${filters.namespace}"`);
    }
    if (filters.resourceName) {
      parts.push(`objectRef.name.contains("${filters.resourceName}")`);
    }
    if (filters.username) {
      parts.push(`user.username.contains("${filters.username}")`);
    }
    return parts.join(" && ");
  }, [filters]);
  const executeQuery = useCallback(() => {
    if (!timeRange || disabled)
      return;
    const filter = useAdvancedFilter ? advancedFilter : generateCEL();
    onFilterChange({
      filter,
      limit,
      startTime: timeRange.start,
      endTime: timeRange.end
    });
  }, [useAdvancedFilter, advancedFilter, generateCEL, onFilterChange, limit, timeRange, disabled]);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    executeQuery();
  }, [filters.verb, filters.resourceType, timeRange, limit, useAdvancedFilter]);
  useEffect(() => {
    if (isInitialMount.current || !timeRange)
      return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      executeQuery();
    }, DEBOUNCE_DELAY);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filters.namespace, filters.resourceName, filters.username, advancedFilter]);
  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);
  const handleTimePresetSelect = useCallback((presetKey) => {
    const preset = TIME_PRESETS$1.find((p2) => p2.key === presetKey);
    if (preset) {
      setSelectedPreset(presetKey);
      setTimeRange(preset.getValue());
    }
  }, []);
  const handleCustomRangeApply = useCallback((start, end) => {
    setSelectedPreset("custom");
    setCustomStart(start);
    setCustomEnd(end);
    setTimeRange({
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString()
    });
  }, []);
  const handleLimitChange = useCallback((newLimit) => {
    const validLimit = Math.min(Math.max(1, newLimit), 1e3);
    setLimit(validLimit);
  }, []);
  const handleAdvancedToggle = useCallback(() => {
    if (!isAdvancedExpanded) {
      setAdvancedFilter(generateCEL());
    }
    setIsAdvancedExpanded(!isAdvancedExpanded);
  }, [isAdvancedExpanded, generateCEL]);
  const handleUseAdvancedChange = useCallback((checked) => {
    setUseAdvancedFilter(checked === true);
  }, []);
  const getTimeRangeLabel = () => {
    if (selectedPreset === "custom") {
      if ((timeRange == null ? void 0 : timeRange.start) && (timeRange == null ? void 0 : timeRange.end)) {
        const start = new Date(timeRange.start);
        const end = new Date(timeRange.end);
        return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
      }
      return "Custom";
    }
    const preset = TIME_PRESETS$1.find((p2) => p2.key === selectedPreset);
    return (preset == null ? void 0 : preset.label) || "Select time range";
  };
  return jsxs("div", { className: `mb-6 pb-6 border-b border-border ${className}`, children: [jsxs("div", { className: "flex flex-wrap gap-4 items-end", children: [jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Action" }), jsx(Combobox, { options: verbs.filter((facet) => facet.value).map((facet) => ({
    value: facet.value,
    label: facet.value,
    count: facet.count
  })), value: filters.verb, onValueChange: (value) => handleFilterChange("verb", value), placeholder: "All", searchPlaceholder: "Search actions...", allOptionLabel: "All", disabled: disabled || useAdvancedFilter, loading: facetsLoading, className: "min-w-[130px]" })] }), jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Resource" }), jsx(Combobox, { options: resources.filter((facet) => facet.value).map((facet) => ({
    value: facet.value,
    label: facet.value,
    count: facet.count
  })), value: filters.resourceType, onValueChange: (value) => handleFilterChange("resourceType", value), placeholder: "All", searchPlaceholder: "Search resources...", allOptionLabel: "All", disabled: disabled || useAdvancedFilter, loading: facetsLoading, className: "min-w-[130px]" })] }), jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Namespace" }), jsx(Combobox, { options: namespaces.filter((facet) => facet.value).map((facet) => ({
    value: facet.value,
    label: facet.value,
    count: facet.count
  })), value: filters.namespace, onValueChange: (value) => handleFilterChange("namespace", value), placeholder: "All", searchPlaceholder: "Search namespaces...", allOptionLabel: "All", disabled: disabled || useAdvancedFilter, loading: facetsLoading, className: "min-w-[130px]" })] }), jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "User" }), jsx(Combobox, { options: usernames.filter((facet) => facet.value).map((facet) => ({
    value: facet.value,
    label: facet.value,
    count: facet.count
  })), value: filters.username, onValueChange: (value) => handleFilterChange("username", value), placeholder: "All", searchPlaceholder: "Search users...", allOptionLabel: "All", disabled: disabled || useAdvancedFilter, loading: facetsLoading, className: "min-w-[130px]" })] }), jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Name" }), jsx(Input, { type: "text", value: filters.resourceName, onChange: (e) => handleFilterChange("resourceName", e.target.value), placeholder: "Filter by name...", className: "min-w-[140px]", disabled: disabled || useAdvancedFilter })] }), jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Limit" }), jsx(Input, { type: "number", value: limit, onChange: (e) => handleLimitChange(parseInt(e.target.value) || 100), min: 1, max: 1e3, className: "w-[80px]", disabled })] }), jsx(Button, { type: "button", variant: "ghost", size: "sm", className: "whitespace-nowrap text-muted-foreground hover:text-foreground", onClick: handleAdvancedToggle, "aria-expanded": isAdvancedExpanded, children: isAdvancedExpanded ? "- CEL" : "+ CEL" }), jsxs("div", { className: "flex flex-col gap-2 ml-auto", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Time Range" }), jsx(TimeRangeDropdown, { presets: TIME_PRESETS$1.map((p2) => ({ key: p2.key, label: p2.label })), selectedPreset, onPresetSelect: handleTimePresetSelect, onCustomRangeApply: handleCustomRangeApply, customStart, customEnd, disabled, displayLabel: getTimeRangeLabel() })] })] }), isAdvancedExpanded && jsxs("div", { className: "mt-4 pt-4", children: [jsx(Separator$1, { className: "mb-4" }), jsx("div", { className: "mb-3", children: jsxs("div", { className: "flex items-center gap-2", children: [jsx(Checkbox, { id: "use-cel-expression", checked: useAdvancedFilter, onCheckedChange: handleUseAdvancedChange, disabled }), jsx(Label$1, { htmlFor: "use-cel-expression", className: "text-sm font-medium text-foreground cursor-pointer", children: "Use CEL Expression" })] }) }), useAdvancedFilter && jsxs("div", { className: "mt-3", children: [jsx("p", { className: "m-0 mb-2 text-[13px] text-muted-foreground", children: "Write your query using CEL syntax for complex filters" }), jsx(Textarea, { value: advancedFilter, onChange: (e) => setAdvancedFilter(e.target.value), placeholder: 'Example: verb == "delete" && objectRef.namespace == "production"', rows: 3, className: "w-full font-mono resize-y", disabled })] })] })] });
}
function AuditEventViewer({ events, className = "", onEventSelect }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState(/* @__PURE__ */ new Set());
  const toggleEventExpansion = (auditId) => {
    const newExpanded = new Set(expandedEvents);
    if (expandedEvents.has(auditId)) {
      newExpanded.delete(auditId);
    } else {
      newExpanded.add(auditId);
    }
    setExpandedEvents(newExpanded);
  };
  const handleEventClick = (event) => {
    setSelectedEvent(event);
    if (onEventSelect) {
      onEventSelect(event);
    }
  };
  const formatTimestamp2 = (timestamp) => {
    if (!timestamp)
      return "N/A";
    try {
      return format(new Date(timestamp), "yyyy-MM-dd HH:mm:ss");
    } catch {
      return timestamp;
    }
  };
  const getVerbBadgeVariant = (verb) => {
    switch (verb == null ? void 0 : verb.toLowerCase()) {
      case "create":
        return "success";
      case "update":
      case "patch":
        return "warning";
      case "delete":
        return "destructive";
      case "get":
      case "list":
      case "watch":
        return "default";
      default:
        return "secondary";
    }
  };
  if (events.length === 0) {
    return jsx("div", { className: `bg-muted rounded-lg border border-border ${className}`, children: jsx("div", { className: "p-12 text-center text-muted-foreground text-sm", children: "No events found" }) });
  }
  return jsx("div", { className: `bg-muted rounded-lg border border-border ${className}`, children: jsx("div", { className: "p-4", children: events.map((event) => {
    var _a, _b, _c, _d, _e2;
    const auditId = event.auditID || "";
    const isExpanded = expandedEvents.has(auditId);
    return jsxs(Card, { className: `p-5 mb-3 cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm hover:-translate-y-px ${(selectedEvent == null ? void 0 : selectedEvent.auditID) === auditId ? "border-primary bg-primary/5 shadow-md" : ""}`, onClick: () => handleEventClick(event), children: [jsxs("div", { className: "flex justify-between items-center", children: [jsxs("div", { className: "flex gap-3 items-center flex-1", children: [jsx(Badge, { variant: getVerbBadgeVariant(event.verb), className: "px-3 py-1", children: ((_a = event.verb) == null ? void 0 : _a.toUpperCase()) || "UNKNOWN" }), jsx("span", { className: "font-semibold", children: ((_b = event.objectRef) == null ? void 0 : _b.resource) || "N/A" }), ((_c = event.objectRef) == null ? void 0 : _c.namespace) && jsxs("span", { className: "text-muted-foreground text-sm", children: ["ns: ", event.objectRef.namespace] }), ((_d = event.objectRef) == null ? void 0 : _d.name) && jsx("span", { className: "text-foreground/80 text-sm", children: event.objectRef.name })] }), jsxs("div", { className: "flex gap-4 items-center", children: [jsx("span", { className: "text-foreground/80 text-sm", children: ((_e2 = event.user) == null ? void 0 : _e2.username) || "N/A" }), jsx("span", { className: "text-muted-foreground text-sm font-mono", children: formatTimestamp2(event.stageTimestamp) }), jsx(Button, { variant: "ghost", size: "sm", onClick: (e) => {
      e.stopPropagation();
      toggleEventExpansion(auditId);
    }, className: "text-primary", children: isExpanded ? "▼" : "▶" })] })] }), isExpanded && jsxs("div", { className: "mt-4 pt-4 border-t border-border", children: [jsxs("div", { className: "mb-4", children: [jsx("h4", { className: "mt-0 mb-2 text-base text-foreground/80", children: "Event Information" }), jsxs("dl", { className: "grid grid-cols-[auto_1fr] gap-2 m-0", children: [jsx("dt", { className: "font-semibold text-foreground/80", children: "Audit ID:" }), jsx("dd", { className: "m-0 text-foreground", children: event.auditID || "N/A" }), jsx("dt", { className: "font-semibold text-foreground/80", children: "Stage:" }), jsx("dd", { className: "m-0 text-foreground", children: event.stage || "N/A" }), jsx("dt", { className: "font-semibold text-foreground/80", children: "Level:" }), jsx("dd", { className: "m-0 text-foreground", children: event.level || "N/A" }), jsx("dt", { className: "font-semibold text-foreground/80", children: "Request URI:" }), jsx("dd", { className: "m-0 text-foreground font-mono text-sm break-all", children: event.requestURI || "N/A" }), event.userAgent && jsxs(Fragment, { children: [jsx("dt", { className: "font-semibold text-foreground/80", children: "User Agent:" }), jsx("dd", { className: "m-0 text-foreground font-mono text-sm break-all", children: event.userAgent })] }), event.sourceIPs && event.sourceIPs.length > 0 && jsxs(Fragment, { children: [jsx("dt", { className: "font-semibold text-foreground/80", children: "Source IPs:" }), jsx("dd", { className: "m-0 text-foreground", children: event.sourceIPs.join(", ") })] })] })] }), event.user && jsxs("div", { className: "mb-4", children: [jsx("h4", { className: "mt-0 mb-2 text-base text-foreground/80", children: "User Information" }), jsxs("dl", { className: "grid grid-cols-[auto_1fr] gap-2 m-0", children: [jsx("dt", { className: "font-semibold text-foreground/80", children: "Username:" }), jsx("dd", { className: "m-0 text-foreground", children: event.user.username || "N/A" }), jsx("dt", { className: "font-semibold text-foreground/80", children: "UID:" }), jsx("dd", { className: "m-0 text-foreground", children: event.user.uid || "N/A" }), event.user.groups && event.user.groups.length > 0 && jsxs(Fragment, { children: [jsx("dt", { className: "font-semibold text-foreground/80", children: "Groups:" }), jsx("dd", { className: "m-0 text-foreground", children: event.user.groups.join(", ") })] })] })] }), event.responseStatus && jsxs("div", { className: "mb-4", children: [jsx("h4", { className: "mt-0 mb-2 text-base text-foreground/80", children: "Response Status" }), jsxs("dl", { className: "grid grid-cols-[auto_1fr] gap-2 m-0", children: [jsx("dt", { className: "font-semibold text-foreground/80", children: "Code:" }), jsx("dd", { className: "m-0 text-foreground", children: event.responseStatus.code || "N/A" }), jsx("dt", { className: "font-semibold text-foreground/80", children: "Status:" }), jsx("dd", { className: "m-0 text-foreground", children: event.responseStatus.status || "N/A" }), event.responseStatus.message && jsxs(Fragment, { children: [jsx("dt", { className: "font-semibold text-foreground/80", children: "Message:" }), jsx("dd", { className: "m-0 text-foreground", children: event.responseStatus.message })] })] })] }), event.annotations && Object.keys(event.annotations).length > 0 && jsxs("div", { className: "mb-4", children: [jsx("h4", { className: "mt-0 mb-2 text-base text-foreground/80", children: "Annotations" }), jsx("dl", { className: "grid grid-cols-[auto_1fr] gap-2 m-0", children: Object.entries(event.annotations).map(([key, value]) => jsxs("div", { className: "contents", children: [jsxs("dt", { className: "font-semibold text-foreground/80", children: [key, ":"] }), jsx("dd", { className: "m-0 text-foreground", children: value })] }, key)) })] }), event.requestObject || event.responseObject ? jsxs("div", { className: "mb-4", children: [jsx("h4", { className: "mt-0 mb-2 text-base text-foreground/80", children: "Request/Response Data" }), event.requestObject ? jsxs("details", { className: "mt-2", children: [jsx("summary", { className: "cursor-pointer font-semibold p-2 bg-muted rounded", children: "Request Object" }), jsx("pre", { className: "mt-2 p-4 bg-muted rounded overflow-x-auto text-sm", children: JSON.stringify(event.requestObject, null, 2) })] }) : null, event.responseObject ? jsxs("details", { className: "mt-2", children: [jsx("summary", { className: "cursor-pointer font-semibold p-2 bg-muted rounded", children: "Response Object" }), jsx("pre", { className: "mt-2 p-4 bg-muted rounded overflow-x-auto text-sm", children: JSON.stringify(event.responseObject, null, 2) })] }) : null] }) : null] })] }, auditId);
  }) }) });
}
function useAuditLogQuery({ client, autoExecute = false }) {
  var _a;
  const [query, setQuery] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSpec, setCurrentSpec] = useState(null);
  const executeQuery = useCallback(async (spec) => {
    var _a2, _b, _c, _d, _e2;
    setIsLoading(true);
    setError(null);
    setCurrentSpec(spec);
    try {
      const queryName = `query-${Date.now()}`;
      const result = await client.createQuery(queryName, spec);
      console.log("[useAuditLogQuery] Query response:", {
        resultCount: (_b = (_a2 = result.status) == null ? void 0 : _a2.results) == null ? void 0 : _b.length,
        continueAfter: (_c = result.status) == null ? void 0 : _c.continueAfter,
        phase: (_d = result.status) == null ? void 0 : _d.phase
      });
      setQuery(result);
      setEvents(((_e2 = result.status) == null ? void 0 : _e2.results) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client]);
  const loadMore = useCallback(async () => {
    var _a2, _b, _c, _d, _e2, _f, _g;
    if (!((_a2 = query == null ? void 0 : query.status) == null ? void 0 : _a2.continueAfter) || !currentSpec) {
      console.log("[useAuditLogQuery] loadMore skipped:", {
        hasContinueAfter: !!((_b = query == null ? void 0 : query.status) == null ? void 0 : _b.continueAfter),
        hasCurrentSpec: !!currentSpec
      });
      return;
    }
    console.log("[useAuditLogQuery] Loading more with continueAfter:", query.status.continueAfter);
    setIsLoading(true);
    setError(null);
    try {
      const nextSpec = {
        ...currentSpec,
        continueAfter: query.status.continueAfter
      };
      const queryName = `query-${Date.now()}`;
      const result = await client.createQuery(queryName, nextSpec);
      console.log("[useAuditLogQuery] loadMore response:", {
        resultCount: (_d = (_c = result.status) == null ? void 0 : _c.results) == null ? void 0 : _d.length,
        continueAfter: (_e2 = result.status) == null ? void 0 : _e2.continueAfter,
        totalEvents: events.length + (((_g = (_f = result.status) == null ? void 0 : _f.results) == null ? void 0 : _g.length) || 0)
      });
      setQuery(result);
      setEvents((prev) => {
        var _a3;
        return [...prev, ...((_a3 = result.status) == null ? void 0 : _a3.results) || []];
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, query, currentSpec, events.length]);
  const reset = useCallback(() => {
    setQuery(null);
    setEvents([]);
    setError(null);
    setCurrentSpec(null);
  }, []);
  return {
    query,
    events,
    isLoading,
    error,
    hasMore: !!((_a = query == null ? void 0 : query.status) == null ? void 0 : _a.continueAfter),
    executeQuery,
    loadMore,
    reset
  };
}
const alertVariants = cva("relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground", {
  variants: {
    variant: {
      default: "bg-background text-foreground",
      destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      warning: "border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:[&>svg]:text-amber-400",
      success: "border-green-200 bg-green-50 text-green-900 [&>svg]:text-green-600 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200 dark:[&>svg]:text-green-400"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});
const Alert = React.forwardRef(({ className, variant, ...props }, ref) => jsx("div", { ref, role: "alert", className: cn(alertVariants({ variant }), className), ...props }));
Alert.displayName = "Alert";
const AlertTitle = React.forwardRef(({ className, ...props }, ref) => jsx("h5", { ref, className: cn("mb-1 font-medium leading-none tracking-tight", className), ...props }));
AlertTitle.displayName = "AlertTitle";
const AlertDescription = React.forwardRef(({ className, ...props }, ref) => jsx("div", { ref, className: cn("text-sm [&_p]:leading-relaxed", className), ...props }));
AlertDescription.displayName = "AlertDescription";
function AuditLogQueryComponent({ client, className = "", onEventSelect, initialFilter, initialLimit }) {
  const [querySpec, setQuerySpec] = useState({
    filter: initialFilter || "",
    limit: initialLimit || 100
  });
  const { events, isLoading, error, hasMore, executeQuery, loadMore } = useAuditLogQuery({ client });
  const loadMoreTriggerRef = useRef(null);
  useEffect(() => {
    if (!loadMoreTriggerRef.current)
      return;
    const observer = new IntersectionObserver((entries) => {
      const entry2 = entries[0];
      if (entry2.isIntersecting && hasMore && !isLoading) {
        loadMore();
      }
    }, {
      rootMargin: "200px",
      threshold: 0
    });
    observer.observe(loadMoreTriggerRef.current);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, loadMore]);
  return jsxs(Card, { className: `flex flex-col p-6 ${className}`, children: [jsx(SimpleQueryBuilder, { client, onFilterChange: async (spec) => {
    setQuerySpec(spec);
    await executeQuery(spec);
  }, initialLimit: querySpec.limit, disabled: isLoading }), error && jsx(Alert, { variant: "destructive", className: "my-6", children: jsxs(AlertDescription, { children: [jsx("strong", { children: "Error:" }), " ", error.message] }) }), isLoading && events.length === 0 && jsxs("div", { className: "flex items-center justify-center gap-3 p-8 text-muted-foreground text-sm", children: [jsx("div", { className: "w-5 h-5 border-[3px] border-muted border-t-[hsl(var(--datum-canyon-clay))] rounded-full animate-spin" }), jsx("span", { children: "Searching audit logs..." })] }), !isLoading && events.length === 0 && !error && jsxs("div", { className: "p-12 text-center text-muted-foreground", children: [jsx("p", { className: "m-0", children: "No audit events found" }), jsx("p", { className: "text-sm text-muted-foreground/70 mt-2", children: "Adjust your filters or time range and search again" })] }), events.length > 0 && jsxs("div", { children: [jsx(AuditEventViewer, { events, onEventSelect }), hasMore && jsx("div", { ref: loadMoreTriggerRef, className: "h-px mt-4" }), isLoading && jsxs("div", { className: "flex items-center justify-center gap-3 p-8 text-muted-foreground text-sm", children: [jsx("div", { className: "w-5 h-5 border-[3px] border-muted border-t-[hsl(var(--datum-canyon-clay))] rounded-full animate-spin" }), jsx("span", { children: "Loading more events..." })] }), !hasMore && events.length > 0 && jsx("div", { className: "text-center p-8 text-muted-foreground text-sm border-t border-border mt-4", children: "End of results" })] })] });
}
const PRESETS = {
  last15min: {
    label: "Last 15 minutes",
    getValue: () => ({
      start: formatISO(subMinutes(/* @__PURE__ */ new Date())),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  },
  last1hour: {
    label: "Last 1 hour",
    getValue: () => ({
      start: formatISO(subHours(/* @__PURE__ */ new Date(), 1)),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  },
  last6hours: {
    label: "Last 6 hours",
    getValue: () => ({
      start: formatISO(subHours(/* @__PURE__ */ new Date(), 6)),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  },
  last24hours: {
    label: "Last 24 hours",
    getValue: () => ({
      start: formatISO(subHours(/* @__PURE__ */ new Date(), 24)),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  },
  last7days: {
    label: "Last 7 days",
    getValue: () => ({
      start: formatISO(subDays(/* @__PURE__ */ new Date(), 7)),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  },
  last30days: {
    label: "Last 30 days",
    getValue: () => ({
      start: formatISO(subDays(/* @__PURE__ */ new Date(), 30)),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  },
  today: {
    label: "Today",
    getValue: () => ({
      start: formatISO(startOfDay(/* @__PURE__ */ new Date())),
      end: formatISO(endOfDay(/* @__PURE__ */ new Date()))
    })
  },
  custom: {
    label: "Custom range",
    getValue: () => ({
      start: formatISO(subHours(/* @__PURE__ */ new Date(), 1)),
      end: formatISO(/* @__PURE__ */ new Date())
    })
  }
};
const formatDatetimeLocal$1 = (isoString) => {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};
function DateTimeRangePicker({ onChange, initialRange, className = "" }) {
  const [selectedPreset, setSelectedPreset] = useState("last24hours");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  useEffect(() => {
    if (initialRange) {
      setCustomStart(formatDatetimeLocal$1(initialRange.start));
      setCustomEnd(formatDatetimeLocal$1(initialRange.end));
      setIsCustom(true);
      setSelectedPreset("custom");
    } else {
      const range = PRESETS["last24hours"].getValue();
      onChange(range);
    }
  }, []);
  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    if (preset === "custom") {
      setIsCustom(true);
      if (!customStart || !customEnd) {
        const defaultRange = PRESETS.last24hours.getValue();
        setCustomStart(formatDatetimeLocal$1(defaultRange.start));
        setCustomEnd(formatDatetimeLocal$1(defaultRange.end));
      }
    } else {
      setIsCustom(false);
      const range = PRESETS[preset].getValue();
      onChange(range);
    }
  };
  const handleCustomApply = () => {
    if (customStart && customEnd) {
      const range = {
        start: new Date(customStart).toISOString(),
        end: new Date(customEnd).toISOString()
      };
      onChange(range);
    }
  };
  const handleCustomStartChange = (value) => {
    setCustomStart(value);
  };
  const handleCustomEndChange = (value) => {
    setCustomEnd(value);
  };
  return jsxs("div", { className: `mb-6 p-4 bg-muted border border-border rounded-lg ${className}`, children: [jsx("div", { className: "flex flex-wrap gap-2 mb-4 max-sm:flex-col", children: Object.keys(PRESETS).map((key) => jsx(Button, { type: "button", variant: selectedPreset === key ? "default" : "outline", className: "max-sm:w-full", onClick: () => handlePresetChange(key), children: PRESETS[key].label }, key)) }), isCustom && jsx(Card, { className: "mt-4", children: jsxs(CardContent, { className: "flex flex-col gap-4 p-4", children: [jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { htmlFor: "custom-start", children: jsx("strong", { children: "Start time" }) }), jsx(Input, { id: "custom-start", type: "datetime-local", value: customStart, onChange: (e) => handleCustomStartChange(e.target.value) })] }), jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { htmlFor: "custom-end", children: jsx("strong", { children: "End time" }) }), jsx(Input, { id: "custom-end", type: "datetime-local", value: customEnd, onChange: (e) => handleCustomEndChange(e.target.value) })] }), jsx(Button, { type: "button", onClick: handleCustomApply, className: "self-start", disabled: !customStart || !customEnd, children: "Apply Custom Range" })] }) })] });
}
const FILTER_DEBOUNCE_MS$1 = 300;
function buildCelFilter(filters) {
  const conditions = [];
  if (filters.changeSource && filters.changeSource !== "all") {
    conditions.push(`spec.changeSource == "${filters.changeSource}"`);
  }
  if (filters.resourceUid) {
    conditions.push(`spec.resource.uid == "${filters.resourceUid}"`);
  }
  if (filters.resourceKinds && filters.resourceKinds.length > 0) {
    if (filters.resourceKinds.length === 1) {
      conditions.push(`spec.resource.kind == "${filters.resourceKinds[0]}"`);
    } else {
      const kindConditions = filters.resourceKinds.map((k2) => `spec.resource.kind == "${k2}"`);
      conditions.push(`(${kindConditions.join(" || ")})`);
    }
  }
  if (filters.actorNames && filters.actorNames.length > 0) {
    if (filters.actorNames.length === 1) {
      conditions.push(`spec.actor.name == "${filters.actorNames[0]}"`);
    } else {
      const actorConditions = filters.actorNames.map((a) => `spec.actor.name == "${a}"`);
      conditions.push(`(${actorConditions.join(" || ")})`);
    }
  }
  if (filters.apiGroups && filters.apiGroups.length > 0) {
    if (filters.apiGroups.length === 1) {
      conditions.push(`spec.resource.apiGroup == "${filters.apiGroups[0]}"`);
    } else {
      const groupConditions = filters.apiGroups.map((g) => `spec.resource.apiGroup == "${g}"`);
      conditions.push(`(${groupConditions.join(" || ")})`);
    }
  }
  if (filters.resourceName) {
    conditions.push(`spec.resource.name.contains("${filters.resourceName}")`);
  }
  if (filters.resourceNamespaces && filters.resourceNamespaces.length > 0) {
    if (filters.resourceNamespaces.length === 1) {
      conditions.push(`spec.resource.namespace == "${filters.resourceNamespaces[0]}"`);
    } else {
      const nsConditions = filters.resourceNamespaces.map((ns) => `spec.resource.namespace == "${ns}"`);
      conditions.push(`(${nsConditions.join(" || ")})`);
    }
  }
  if (filters.customFilter) {
    conditions.push(filters.customFilter);
  }
  return conditions.length > 0 ? conditions.join(" && ") : void 0;
}
function useActivityFeed({ client, initialFilters = {}, initialTimeRange = { start: "now-7d" }, pageSize = 30, enableStreaming = false, autoStartStreaming = true }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [continueCursor, setContinueCursor] = useState();
  const [filters, setFilters] = useState(initialFilters);
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [isStreaming, setIsStreaming] = useState(false);
  const [newActivitiesCount, setNewActivitiesCount] = useState(0);
  const resourceVersionRef = useRef();
  const watchStopRef = useRef(null);
  const shouldRestartStreamingRef = useRef(false);
  const hasInitialLoadRef = useRef(false);
  const filterDebounceRef = useRef(null);
  const buildParams = useCallback((cursor) => {
    return {
      filter: buildCelFilter(filters),
      search: filters.search,
      start: timeRange.start,
      end: timeRange.end,
      limit: pageSize,
      continue: cursor
    };
  }, [filters, timeRange, pageSize]);
  const handleWatchEvent = useCallback((event) => {
    var _a, _b;
    if (event.type === "ERROR") {
      console.error("Watch error:", event.object);
      return;
    }
    if (event.type === "BOOKMARK") {
      if ((_a = event.object.metadata) == null ? void 0 : _a.resourceVersion) {
        resourceVersionRef.current = event.object.metadata.resourceVersion;
      }
      return;
    }
    if ((_b = event.object.metadata) == null ? void 0 : _b.resourceVersion) {
      resourceVersionRef.current = event.object.metadata.resourceVersion;
    }
    if (event.type === "ADDED") {
      setActivities((prev) => {
        const exists = prev.some((a) => {
          var _a2, _b2;
          return ((_a2 = a.metadata) == null ? void 0 : _a2.name) === ((_b2 = event.object.metadata) == null ? void 0 : _b2.name);
        });
        if (exists) {
          return prev;
        }
        return [event.object, ...prev];
      });
      setNewActivitiesCount((prev) => prev + 1);
    } else if (event.type === "MODIFIED") {
      setActivities((prev) => prev.map((a) => {
        var _a2, _b2;
        return ((_a2 = a.metadata) == null ? void 0 : _a2.name) === ((_b2 = event.object.metadata) == null ? void 0 : _b2.name) ? event.object : a;
      }));
    } else if (event.type === "DELETED") {
      setActivities((prev) => prev.filter((a) => {
        var _a2, _b2;
        return ((_a2 = a.metadata) == null ? void 0 : _a2.name) !== ((_b2 = event.object.metadata) == null ? void 0 : _b2.name);
      }));
    }
  }, []);
  const startStreaming = useCallback(() => {
    if (watchStopRef.current) {
      return;
    }
    const params = buildParams();
    const { stop } = client.watchActivities(params, {
      resourceVersion: resourceVersionRef.current,
      onEvent: handleWatchEvent,
      onError: (err) => {
        console.error("Watch stream error:", err);
        setError(err);
        setIsStreaming(false);
        watchStopRef.current = null;
      },
      onClose: () => {
        setIsStreaming(false);
        watchStopRef.current = null;
      }
    });
    watchStopRef.current = stop;
    setIsStreaming(true);
    setNewActivitiesCount(0);
  }, [client, buildParams, handleWatchEvent]);
  const stopStreaming = useCallback(() => {
    if (watchStopRef.current) {
      watchStopRef.current();
      watchStopRef.current = null;
    }
    setIsStreaming(false);
  }, []);
  const refresh = useCallback(async () => {
    var _a, _b;
    setIsLoading(true);
    setError(null);
    setNewActivitiesCount(0);
    try {
      const params = buildParams();
      const result = await client.listActivities(params);
      setActivities(result.items || []);
      setContinueCursor((_a = result.metadata) == null ? void 0 : _a.continue);
      if ((_b = result.metadata) == null ? void 0 : _b.resourceVersion) {
        resourceVersionRef.current = result.metadata.resourceVersion;
      }
      hasInitialLoadRef.current = true;
      if (shouldRestartStreamingRef.current && enableStreaming) {
        shouldRestartStreamingRef.current = false;
        setTimeout(() => {
          if (watchStopRef.current === null) {
          }
        }, 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      shouldRestartStreamingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [client, buildParams, enableStreaming]);
  const loadMore = useCallback(async () => {
    var _a;
    if (!continueCursor || isLoading) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const params = buildParams(continueCursor);
      const result = await client.listActivities(params);
      setActivities((prev) => [...prev, ...result.items || []]);
      setContinueCursor((_a = result.metadata) == null ? void 0 : _a.continue);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, buildParams, continueCursor, isLoading]);
  const updateFilters = useCallback((newFilters) => {
    if (isStreaming) {
      shouldRestartStreamingRef.current = true;
      stopStreaming();
    }
    setFilters(newFilters);
    setActivities([]);
    setContinueCursor(void 0);
    resourceVersionRef.current = void 0;
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }
    filterDebounceRef.current = setTimeout(() => {
      filterDebounceRef.current = null;
    }, FILTER_DEBOUNCE_MS$1);
  }, [stopStreaming, isStreaming]);
  const updateTimeRange = useCallback((newTimeRange) => {
    if (isStreaming) {
      shouldRestartStreamingRef.current = true;
      stopStreaming();
    }
    setTimeRange(newTimeRange);
    setActivities([]);
    setContinueCursor(void 0);
    resourceVersionRef.current = void 0;
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }
    filterDebounceRef.current = setTimeout(() => {
      filterDebounceRef.current = null;
    }, FILTER_DEBOUNCE_MS$1);
  }, [stopStreaming, isStreaming]);
  const reset = useCallback(() => {
    stopStreaming();
    setActivities([]);
    setError(null);
    setContinueCursor(void 0);
    setFilters(initialFilters);
    setTimeRange(initialTimeRange);
    setNewActivitiesCount(0);
    resourceVersionRef.current = void 0;
  }, [initialFilters, initialTimeRange, stopStreaming]);
  useEffect(() => {
    if (!hasInitialLoadRef.current) {
      return;
    }
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }
    filterDebounceRef.current = setTimeout(() => {
      filterDebounceRef.current = null;
      refresh();
    }, FILTER_DEBOUNCE_MS$1);
    return () => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
        filterDebounceRef.current = null;
      }
    };
  }, [filters, timeRange]);
  useEffect(() => {
    if (enableStreaming && autoStartStreaming && activities.length > 0 && !isStreaming && !isLoading) {
      startStreaming();
    }
  }, [enableStreaming, autoStartStreaming, activities.length, isStreaming, isLoading, startStreaming]);
  useEffect(() => {
    if (enableStreaming && shouldRestartStreamingRef.current && activities.length > 0 && !isStreaming && !isLoading) {
      shouldRestartStreamingRef.current = false;
      startStreaming();
    }
  }, [enableStreaming, activities.length, isStreaming, isLoading, startStreaming]);
  useEffect(() => {
    return () => {
      if (watchStopRef.current) {
        watchStopRef.current();
      }
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
      }
    };
  }, []);
  const hasMore = useMemo(() => !!continueCursor, [continueCursor]);
  return {
    activities,
    isLoading,
    error,
    hasMore,
    filters,
    timeRange,
    refresh,
    loadMore,
    setFilters: updateFilters,
    setTimeRange: updateTimeRange,
    reset,
    isStreaming,
    startStreaming,
    stopStreaming,
    newActivitiesCount
  };
}
function parseSummaryWithLinks(summary, links2, onResourceClick) {
  if (!links2 || links2.length === 0) {
    return [summary];
  }
  const sortedLinks = [...links2].sort((a, b) => b.marker.length - a.marker.length);
  const replacedRanges = [];
  for (const link of sortedLinks) {
    let searchStart = 0;
    let pos = summary.indexOf(link.marker, searchStart);
    while (pos !== -1) {
      const end = pos + link.marker.length;
      const overlaps = replacedRanges.some((range) => pos < range.end && end > range.start);
      if (!overlaps) {
        replacedRanges.push({ start: pos, end, link });
      }
      searchStart = pos + 1;
      pos = summary.indexOf(link.marker, searchStart);
    }
  }
  replacedRanges.sort((a, b) => a.start - b.start);
  const result = [];
  let lastEnd = 0;
  for (let i = 0; i < replacedRanges.length; i++) {
    const range = replacedRanges[i];
    if (range.start > lastEnd) {
      result.push(summary.substring(lastEnd, range.start));
    }
    const handleClick = onResourceClick ? (e) => {
      e.preventDefault();
      e.stopPropagation();
      onResourceClick(range.link.resource);
    } : void 0;
    result.push(jsx("button", { type: "button", className: "bg-transparent border-none p-0 cursor-pointer underline underline-offset-2 text-primary hover:text-primary/80", onClick: handleClick, title: `${range.link.resource.kind}: ${range.link.resource.name}`, children: range.link.marker }, `link-${i}`));
    lastEnd = range.end;
  }
  if (lastEnd < summary.length) {
    result.push(summary.substring(lastEnd));
  }
  return result;
}
function ActivityFeedSummary({ summary, links: links2, onResourceClick, className = "" }) {
  const parsedContent = parseSummaryWithLinks(summary, links2, onResourceClick);
  return jsx("span", { className: `text-[0.9375rem] text-foreground leading-normal break-words ${className}`, children: parsedContent });
}
function formatTimestampFull$2(timestamp) {
  if (!timestamp)
    return "Unknown time";
  try {
    return format(new Date(timestamp), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return timestamp;
  }
}
function ActivityExpandedDetails({ activity }) {
  const { spec, metadata } = activity;
  const { actor, resource, origin, changes } = spec;
  const timestamp = metadata == null ? void 0 : metadata.creationTimestamp;
  return jsxs("div", { className: "mt-4 pt-4 border-t border-border space-y-4", children: [changes && changes.length > 0 && jsxs("div", { children: [jsx("h4", { className: "m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Changes" }), jsx("div", { className: "flex flex-col gap-2", children: changes.map((change, index2) => jsxs("div", { className: "p-2 bg-muted rounded text-sm", children: [jsx("span", { className: "block font-semibold text-foreground mb-1 font-mono text-xs", children: change.field }), change.old && jsxs("span", { className: "block ml-2 text-red-600 dark:text-red-400 text-xs", children: [jsx("span", { className: "font-medium mr-1", children: "−" }), jsx("span", { className: "line-through", children: change.old })] }), change.new && jsxs("span", { className: "block ml-2 text-green-600 dark:text-green-400 text-xs", children: [jsx("span", { className: "font-medium mr-1", children: "+" }), change.new] })] }, index2)) })] }), jsxs("div", { children: [jsx("h4", { className: "m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Timestamp" }), jsx("p", { className: "m-0 text-foreground text-xs", children: formatTimestampFull$2(timestamp) })] }), jsxs("div", { children: [jsx("h4", { className: "m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Actor" }), jsxs("dl", { className: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm", children: [jsx("dt", { className: "text-muted-foreground text-xs", children: "Name:" }), jsx("dd", { className: "m-0 text-foreground text-xs break-all", children: actor.name }), jsx("dt", { className: "text-muted-foreground text-xs", children: "Type:" }), jsx("dd", { className: "m-0 text-foreground text-xs", children: actor.type }), actor.email && jsxs(Fragment, { children: [jsx("dt", { className: "text-muted-foreground text-xs", children: "Email:" }), jsx("dd", { className: "m-0 text-foreground text-xs break-all", children: actor.email })] }), jsx("dt", { className: "text-muted-foreground text-xs", children: "UID:" }), jsx("dd", { className: "m-0 font-mono text-xs text-muted-foreground break-all", children: actor.uid })] })] }), jsxs("div", { children: [jsx("h4", { className: "m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Resource" }), jsxs("dl", { className: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm", children: [jsx("dt", { className: "text-muted-foreground text-xs", children: "Kind:" }), jsx("dd", { className: "m-0 text-foreground text-xs", children: resource.kind }), jsx("dt", { className: "text-muted-foreground text-xs", children: "Name:" }), jsx("dd", { className: "m-0 text-foreground text-xs", children: resource.name }), resource.namespace && jsxs(Fragment, { children: [jsx("dt", { className: "text-muted-foreground text-xs", children: "Namespace:" }), jsx("dd", { className: "m-0 text-foreground text-xs", children: resource.namespace })] }), resource.apiGroup && jsxs(Fragment, { children: [jsx("dt", { className: "text-muted-foreground text-xs", children: "API Group:" }), jsx("dd", { className: "m-0 text-foreground text-xs", children: resource.apiGroup })] }), resource.uid && jsxs(Fragment, { children: [jsx("dt", { className: "text-muted-foreground text-xs", children: "UID:" }), jsx("dd", { className: "m-0 font-mono text-xs text-muted-foreground break-all", children: resource.uid })] })] })] }), jsxs("div", { children: [jsx("h4", { className: "m-0 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Origin" }), jsxs("dl", { className: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 text-sm", children: [jsx("dt", { className: "text-muted-foreground text-xs", children: "Type:" }), jsx("dd", { className: "m-0 text-foreground text-xs", children: origin.type }), jsx("dt", { className: "text-muted-foreground text-xs", children: "ID:" }), jsx("dd", { className: "m-0 font-mono text-xs text-muted-foreground break-all", children: origin.id })] })] })] });
}
function formatTimestamp$2(timestamp) {
  if (!timestamp)
    return "Unknown time";
  try {
    const date = new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return timestamp;
  }
}
function formatTimestampFull$1(timestamp) {
  if (!timestamp)
    return "Unknown time";
  try {
    return format(new Date(timestamp), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return timestamp;
  }
}
function getActorInitials(name) {
  const parts = name.split(/[@\s.]+/).filter(Boolean);
  if (parts.length === 0)
    return "?";
  if (parts.length === 1)
    return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
function getActorAvatarClasses(actorType, compact) {
  const baseClasses = cn("rounded-full flex items-center justify-center shrink-0 font-semibold", compact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm");
  switch (actorType) {
    case "user":
      return cn(baseClasses, "bg-lime-200 text-slate-900 dark:bg-lime-800 dark:text-lime-100");
    case "controller":
      return cn(baseClasses, "bg-rose-300 text-slate-900 dark:bg-rose-800 dark:text-rose-100");
    case "machine account":
      return cn(baseClasses, "bg-muted text-muted-foreground");
    default:
      return cn(baseClasses, "bg-muted text-muted-foreground");
  }
}
function extractVerb(summary) {
  const words = summary.split(/\s+/);
  if (words.length >= 2) {
    return words[1].toLowerCase();
  }
  return "unknown";
}
function normalizeVerb(verb) {
  const normalized = verb.toLowerCase();
  if (normalized.includes("create") || normalized.includes("add"))
    return "create";
  if (normalized.includes("delete") || normalized.includes("remove"))
    return "delete";
  if (normalized.includes("update") || normalized.includes("patch") || normalized.includes("modify") || normalized.includes("change") || normalized.includes("edit"))
    return "update";
  return "other";
}
function getTimelineNodeClasses(verb) {
  const normalizedVerb = normalizeVerb(verb);
  switch (normalizedVerb) {
    case "create":
      return "bg-green-500";
    case "update":
      return "bg-amber-500";
    case "delete":
      return "bg-red-500";
    default:
      return "bg-muted-foreground";
  }
}
function ActivityFeedItem({ activity, onResourceClick, onActivityClick, isSelected = false, className = "", compact = false, isNew = false, variant = "feed", isFirst = false, isLast = false, defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { spec, metadata } = activity;
  const { actor, summary, changeSource, resource, links: links2 } = spec;
  const handleClick = () => {
    onActivityClick == null ? void 0 : onActivityClick(activity);
  };
  const toggleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };
  const timestamp = metadata == null ? void 0 : metadata.creationTimestamp;
  const verb = extractVerb(summary);
  const isTimeline = variant === "timeline";
  if (isTimeline) {
    return jsxs("div", { className: cn("relative cursor-pointer group flex", compact ? "pl-7" : "pl-9", className), onClick: handleClick, children: [jsxs("div", { className: cn("absolute left-0 top-0 bottom-0 flex flex-col items-center", compact ? "w-7" : "w-9"), children: [jsx("div", { className: cn("w-0.5 flex-1", isFirst ? "bg-transparent" : "bg-border"), style: { minHeight: compact ? 12 : 16 } }), jsx("div", { className: cn("rounded-full shrink-0 z-10", compact ? "w-2.5 h-2.5" : "w-3 h-3", getTimelineNodeClasses(verb)) }), jsx("div", { className: cn("w-0.5 flex-1", isLast ? "bg-transparent" : "bg-border") })] }), jsxs("div", { className: cn("flex-1 border border-border rounded-lg transition-all duration-200", "hover:border-rose-300 hover:shadow-sm dark:hover:border-rose-600", compact ? "p-3 mb-3" : "p-4 mb-4", isSelected && "border-rose-300 bg-rose-50/50 dark:border-rose-600 dark:bg-rose-950/30"), children: [jsxs("div", { className: "flex justify-between items-start gap-4 mb-2", children: [jsx("div", { className: cn("leading-relaxed", compact ? "text-sm" : "text-[0.9375rem]"), children: jsx(ActivityFeedSummary, { summary, links: links2, onResourceClick }) }), jsx("span", { className: "text-xs text-muted-foreground whitespace-nowrap", title: formatTimestampFull$1(timestamp), children: formatTimestamp$2(timestamp) })] }), jsxs("div", { className: "flex items-center gap-3 text-xs text-muted-foreground", children: [jsxs("span", { className: cn("inline-flex items-center gap-1", changeSource === "human" ? "text-green-600 dark:text-green-400" : "text-muted-foreground"), children: [changeSource === "human" ? jsx("svg", { className: "w-3 h-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }) : jsxs("svg", { className: "w-3 h-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }), jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })] }), changeSource] }), jsx(Button, { variant: "ghost", size: "sm", className: "ml-auto h-auto py-0 px-1 text-xs text-muted-foreground hover:text-foreground", onClick: toggleExpand, "aria-expanded": isExpanded, children: isExpanded ? "▾ Less" : "▸ More" })] }), isExpanded && jsx(ActivityExpandedDetails, { activity })] })] });
  }
  return jsxs(Card, { className: cn("cursor-pointer transition-all duration-200", "hover:border-rose-300 hover:shadow-sm hover:-translate-y-px dark:hover:border-rose-600", compact ? "p-3 mb-2" : "p-4 mb-3", isSelected && "border-rose-300 bg-rose-50 shadow-md dark:border-rose-600 dark:bg-rose-950/50", isNew && "border-l-4 border-l-green-500 bg-green-50/50 dark:border-l-green-400 dark:bg-green-950/30", className), onClick: handleClick, children: [jsxs("div", { className: "flex gap-4", children: [jsx("div", { className: getActorAvatarClasses(actor.type, compact), title: actor.name, children: actor.type === "controller" ? jsx("span", { className: compact ? "text-base" : "text-xl", children: "⚙" }) : actor.type === "machine account" ? jsx("span", { className: compact ? "text-base" : "text-xl", children: "🤖" }) : jsx("span", { className: "uppercase", children: getActorInitials(actor.name) }) }), jsxs("div", { className: "flex-1 min-w-0", children: [jsxs("div", { className: "flex justify-between items-start gap-4 mb-2", children: [jsx("div", { className: cn("leading-relaxed", compact ? "text-sm" : "text-[0.9375rem]"), children: jsx(ActivityFeedSummary, { summary, links: links2, onResourceClick }) }), jsx("span", { className: "text-xs text-muted-foreground whitespace-nowrap", title: formatTimestampFull$1(timestamp), children: formatTimestamp$2(timestamp) })] }), jsxs("div", { className: "flex items-center gap-3 text-xs text-muted-foreground", children: [jsxs("span", { className: cn("inline-flex items-center gap-1", changeSource === "human" ? "text-green-600 dark:text-green-400" : "text-muted-foreground"), children: [changeSource === "human" ? jsx("svg", { className: "w-3 h-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }) : jsxs("svg", { className: "w-3 h-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }), jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })] }), changeSource] }), jsx(Button, { variant: "ghost", size: "sm", className: "ml-auto h-auto py-0 px-1 text-xs text-muted-foreground hover:text-foreground", onClick: toggleExpand, "aria-expanded": isExpanded, children: isExpanded ? "▾ Less" : "▸ More" })] })] })] }), isExpanded && jsx(ActivityExpandedDetails, { activity })] });
}
function buildFacetFilter(filters) {
  const conditions = [];
  if (filters.changeSource && filters.changeSource !== "all") {
    conditions.push(`spec.changeSource == "${filters.changeSource}"`);
  }
  if (filters.resourceUid) {
    conditions.push(`spec.resource.uid == "${filters.resourceUid}"`);
  }
  if (filters.resourceKinds && filters.resourceKinds.length > 0) {
    if (filters.resourceKinds.length === 1) {
      conditions.push(`spec.resource.kind == "${filters.resourceKinds[0]}"`);
    } else {
      const kindConditions = filters.resourceKinds.map((k2) => `spec.resource.kind == "${k2}"`);
      conditions.push(`(${kindConditions.join(" || ")})`);
    }
  }
  if (filters.actorNames && filters.actorNames.length > 0) {
    if (filters.actorNames.length === 1) {
      conditions.push(`spec.actor.name == "${filters.actorNames[0]}"`);
    } else {
      const actorConditions = filters.actorNames.map((a) => `spec.actor.name == "${a}"`);
      conditions.push(`(${actorConditions.join(" || ")})`);
    }
  }
  if (filters.apiGroups && filters.apiGroups.length > 0) {
    if (filters.apiGroups.length === 1) {
      conditions.push(`spec.resource.apiGroup == "${filters.apiGroups[0]}"`);
    } else {
      const groupConditions = filters.apiGroups.map((g) => `spec.resource.apiGroup == "${g}"`);
      conditions.push(`(${groupConditions.join(" || ")})`);
    }
  }
  if (filters.resourceNamespaces && filters.resourceNamespaces.length > 0) {
    if (filters.resourceNamespaces.length === 1) {
      conditions.push(`spec.resource.namespace == "${filters.resourceNamespaces[0]}"`);
    } else {
      const nsConditions = filters.resourceNamespaces.map((ns) => `spec.resource.namespace == "${ns}"`);
      conditions.push(`(${nsConditions.join(" || ")})`);
    }
  }
  if (filters.customFilter) {
    conditions.push(`(${filters.customFilter})`);
  }
  return conditions.length > 0 ? conditions.join(" && ") : void 0;
}
function useFacets(client, timeRange, filters = {}) {
  const [resourceKinds, setResourceKinds] = useState([]);
  const [actorNames, setActorNames] = useState([]);
  const [apiGroups, setApiGroups] = useState([]);
  const [resourceNamespaces, setResourceNamespaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastFetchedRef = useRef(null);
  const fetchFacets = useCallback(async () => {
    var _a;
    const filter = buildFacetFilter(filters);
    const cacheKey = `${timeRange.start}-${timeRange.end || "now"}-${filter || ""}`;
    if (lastFetchedRef.current === cacheKey) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.queryFacets({
        timeRange: {
          start: timeRange.start,
          end: timeRange.end
        },
        filter,
        facets: [
          { field: "spec.resource.kind", limit: 50 },
          { field: "spec.actor.name", limit: 50 },
          { field: "spec.resource.apiGroup", limit: 50 },
          { field: "spec.resource.namespace", limit: 50 }
        ]
      });
      const facets = ((_a = result.status) == null ? void 0 : _a.facets) || [];
      const kindFacet = facets.find((f) => f.field === "spec.resource.kind");
      setResourceKinds((kindFacet == null ? void 0 : kindFacet.values) || []);
      const actorFacet = facets.find((f) => f.field === "spec.actor.name");
      setActorNames((actorFacet == null ? void 0 : actorFacet.values) || []);
      const apiGroupFacet = facets.find((f) => f.field === "spec.resource.apiGroup");
      setApiGroups((apiGroupFacet == null ? void 0 : apiGroupFacet.values) || []);
      const namespaceFacet = facets.find((f) => f.field === "spec.resource.namespace");
      setResourceNamespaces((namespaceFacet == null ? void 0 : namespaceFacet.values) || []);
      lastFetchedRef.current = cacheKey;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, timeRange.start, timeRange.end, filters]);
  useEffect(() => {
    fetchFacets();
  }, [fetchFacets]);
  const refresh = useCallback(async () => {
    lastFetchedRef.current = null;
    await fetchFacets();
  }, [fetchFacets]);
  return {
    resourceKinds,
    actorNames,
    apiGroups,
    resourceNamespaces,
    isLoading,
    error,
    refresh
  };
}
const OPTIONS$1 = [
  {
    value: "all",
    label: "All",
    description: "Show all activities"
  },
  {
    value: "human",
    label: "Human",
    description: "Show only human-initiated activities"
  },
  {
    value: "system",
    label: "System",
    description: "Show only system-initiated activities"
  }
];
function ChangeSourceToggle({ value, onChange, className = "", disabled = false }) {
  return jsx("div", { className: cn("inline-flex border border-input rounded-md overflow-hidden", className), role: "group", "aria-label": "Filter by change source", children: OPTIONS$1.map((option, index2) => jsx(Button, { type: "button", variant: "ghost", className: cn("rounded-none px-4 py-2 text-sm font-medium transition-all duration-200", index2 < OPTIONS$1.length - 1 && "border-r border-input", value === option.value ? "bg-[#BF9595] text-[#0C1D31] hover:bg-[#BF9595]/90" : "bg-muted text-foreground hover:bg-muted/80"), onClick: () => onChange(option.value), disabled, "aria-pressed": value === option.value, title: option.description, children: option.label }, option.value)) });
}
function MultiCombobox({ options, values, onValuesChange, placeholder = "Select...", searchPlaceholder = "Search...", emptyMessage = "No results found.", disabled = false, loading = false, className, maxDisplayed = 2 }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selectedOptions = options.filter((opt) => values.includes(opt.value));
  const displayValue = React.useMemo(() => {
    if (loading)
      return "Loading...";
    if (selectedOptions.length === 0)
      return placeholder;
    if (selectedOptions.length <= maxDisplayed) {
      return selectedOptions.map((opt) => opt.label).join(", ");
    }
    return `${selectedOptions.slice(0, maxDisplayed).map((opt) => opt.label).join(", ")} +${selectedOptions.length - maxDisplayed} more`;
  }, [loading, selectedOptions, placeholder, maxDisplayed]);
  const handleSelect = React.useCallback((selectedValue) => {
    if (values.includes(selectedValue)) {
      onValuesChange(values.filter((v) => v !== selectedValue));
    } else {
      onValuesChange([...values, selectedValue]);
    }
  }, [onValuesChange, values]);
  const handleClear = React.useCallback((e) => {
    e.stopPropagation();
    onValuesChange([]);
  }, [onValuesChange]);
  const handleRemove = React.useCallback((e, valueToRemove) => {
    e.stopPropagation();
    onValuesChange(values.filter((v) => v !== valueToRemove));
  }, [onValuesChange, values]);
  const filterOptions = React.useCallback((optionValue, searchQuery) => {
    if (!searchQuery)
      return 1;
    const option = options.find((o) => o.value === optionValue);
    const label = (option == null ? void 0 : option.label) || optionValue;
    const lowerLabel = label.toLowerCase();
    const lowerSearch = searchQuery.toLowerCase();
    if (lowerLabel === lowerSearch)
      return 1;
    if (lowerLabel.startsWith(lowerSearch))
      return 0.9;
    if (lowerLabel.includes(lowerSearch))
      return 0.8;
    let searchIdx = 0;
    for (let i = 0; i < lowerLabel.length && searchIdx < lowerSearch.length; i++) {
      if (lowerLabel[i] === lowerSearch[searchIdx]) {
        searchIdx++;
      }
    }
    if (searchIdx === lowerSearch.length)
      return 0.6;
    return 0;
  }, [options]);
  return jsxs(Root2$2, { open, onOpenChange: setOpen, children: [jsx(Trigger$2, { asChild: true, children: jsxs("button", { type: "button", role: "combobox", "aria-expanded": open, "aria-haspopup": "listbox", disabled: disabled || loading, className: cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background", "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", "disabled:cursor-not-allowed disabled:opacity-50", className), children: [jsx("span", { className: "truncate text-left flex-1", children: displayValue }), jsxs("div", { className: "flex items-center gap-1 ml-2", children: [values.length > 0 && !disabled && jsx("span", { role: "button", tabIndex: 0, onClick: handleClear, onKeyDown: (e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClear(e);
    }
  }, className: "rounded-sm opacity-50 hover:opacity-100 cursor-pointer", children: jsx(X$1, { className: "h-3 w-3" }) }), jsx(ChevronsUpDown, { className: "h-4 w-4 shrink-0 opacity-50" })] })] }) }), jsx(Portal$1, { children: jsx(Content2$1, { className: cn("z-50 min-w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md", "data-[state=open]:animate-in data-[state=closed]:animate-out", "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"), sideOffset: 4, align: "start", children: jsxs(_e, { filter: filterOptions, className: "w-full", children: [jsx("div", { className: "flex items-center border-b px-3", children: jsx(Se, { placeholder: searchPlaceholder, value: search, onValueChange: setSearch, className: "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50" }) }), values.length > 0 && jsx("div", { className: "flex flex-wrap gap-1 p-2 border-b", children: selectedOptions.map((option) => jsxs("span", { className: "inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs", children: [option.label, jsx("button", { type: "button", onClick: (e) => handleRemove(e, option.value), className: "rounded-sm hover:bg-secondary-foreground/20", children: jsx(X$1, { className: "h-3 w-3" }) })] }, option.value)) }), jsxs(Ce, { className: "max-h-[300px] overflow-y-auto p-1", children: [jsx(Ie, { className: "py-6 text-center text-sm text-muted-foreground", children: emptyMessage }), jsx(Ee, { children: options.map((option) => jsxs(he, { value: option.value, onSelect: () => handleSelect(option.value), className: cn("relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none", "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground", "hover:bg-accent hover:text-accent-foreground"), children: [jsx(Check, { className: cn("mr-2 h-4 w-4", values.includes(option.value) ? "opacity-100" : "opacity-0") }), jsx("span", { className: "flex-1 truncate", children: option.label }), option.count !== void 0 && jsxs("span", { className: "ml-2 text-xs text-muted-foreground", children: ["(", option.count, ")"] })] }, option.value)) })] })] }) }) })] });
}
const SEARCH_DEBOUNCE_MS = 300;
const TIME_PRESETS = [
  { key: "now-1h", label: "Last hour" },
  { key: "now-24h", label: "Last 24 hours" },
  { key: "now-7d", label: "Last 7 days" },
  { key: "now-30d", label: "Last 30 days" }
];
const formatDatetimeLocal = (isoString) => {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};
const getSelectedPreset = (timeRange) => {
  const preset = TIME_PRESETS.find((p2) => timeRange.start === p2.key);
  return preset ? preset.key : "custom";
};
function ActivityFeedFilters({ client, filters, timeRange, onFiltersChange, onTimeRangeChange, disabled = false, className = "", showSearch = true }) {
  const { resourceKinds, actorNames, apiGroups, resourceNamespaces, isLoading: facetsLoading, error: facetsError } = useFacets(client, timeRange, filters);
  if (facetsError) {
    console.error("Failed to load facets:", facetsError);
  }
  const [searchValue, setSearchValue] = useState(filters.search || "");
  const [resourceNameValue, setResourceNameValue] = useState(filters.resourceName || "");
  const searchDebounceRef = useRef(null);
  const resourceNameDebounceRef = useRef(null);
  const selectedPreset = getSelectedPreset(timeRange);
  const [customStart, setCustomStart] = useState(() => {
    if (selectedPreset === "custom") {
      return formatDatetimeLocal(timeRange.start);
    }
    return formatDatetimeLocal(formatISO(subDays(/* @__PURE__ */ new Date(), 1)));
  });
  const [customEnd, setCustomEnd] = useState(() => {
    if (selectedPreset === "custom" && timeRange.end) {
      return formatDatetimeLocal(timeRange.end);
    }
    return formatDatetimeLocal(formatISO(/* @__PURE__ */ new Date()));
  });
  useEffect(() => {
    if (filters.search !== searchValue) {
      setSearchValue(filters.search || "");
    }
  }, [filters.search]);
  useEffect(() => {
    if (filters.resourceName !== resourceNameValue) {
      setResourceNameValue(filters.resourceName || "");
    }
  }, [filters.resourceName]);
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      if (resourceNameDebounceRef.current) {
        clearTimeout(resourceNameDebounceRef.current);
      }
    };
  }, []);
  const handleChangeSourceChange = useCallback((value) => {
    onFiltersChange({
      ...filters,
      changeSource: value
    });
  }, [filters, onFiltersChange]);
  const handleTimePresetSelect = useCallback((presetKey) => {
    onTimeRangeChange({
      start: presetKey,
      end: void 0
    });
  }, [onTimeRangeChange]);
  const handleCustomRangeApply = useCallback((start, end) => {
    setCustomStart(start);
    setCustomEnd(end);
    onTimeRangeChange({
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString()
    });
  }, [onTimeRangeChange]);
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchValue(value);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      onFiltersChange({
        ...filters,
        search: value || void 0
      });
    }, SEARCH_DEBOUNCE_MS);
  }, [filters, onFiltersChange]);
  const handleSearchClear = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    setSearchValue("");
    onFiltersChange({
      ...filters,
      search: void 0
    });
  }, [filters, onFiltersChange]);
  const handleResourceKindsChange = (values) => {
    onFiltersChange({
      ...filters,
      resourceKinds: values.length > 0 ? values : void 0
    });
  };
  const handleActorNamesChange = (values) => {
    onFiltersChange({
      ...filters,
      actorNames: values.length > 0 ? values : void 0
    });
  };
  const handleApiGroupsChange = (values) => {
    onFiltersChange({
      ...filters,
      apiGroups: values.length > 0 ? values : void 0
    });
  };
  const handleResourceNamespacesChange = (values) => {
    onFiltersChange({
      ...filters,
      resourceNamespaces: values.length > 0 ? values : void 0
    });
  };
  const handleResourceNameChange = useCallback((e) => {
    const value = e.target.value;
    setResourceNameValue(value);
    if (resourceNameDebounceRef.current) {
      clearTimeout(resourceNameDebounceRef.current);
    }
    resourceNameDebounceRef.current = setTimeout(() => {
      resourceNameDebounceRef.current = null;
      onFiltersChange({
        ...filters,
        resourceName: value || void 0
      });
    }, SEARCH_DEBOUNCE_MS);
  }, [filters, onFiltersChange]);
  const handleResourceNameClear = useCallback(() => {
    if (resourceNameDebounceRef.current) {
      clearTimeout(resourceNameDebounceRef.current);
      resourceNameDebounceRef.current = null;
    }
    setResourceNameValue("");
    onFiltersChange({
      ...filters,
      resourceName: void 0
    });
  }, [filters, onFiltersChange]);
  const getTimeRangeLabel = () => {
    const preset = TIME_PRESETS.find((p2) => p2.key === selectedPreset);
    if (preset)
      return preset.label;
    if (selectedPreset === "custom" && timeRange.start && timeRange.end) {
      const start = new Date(timeRange.start);
      const end = new Date(timeRange.end);
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }
    return "Select time range";
  };
  return jsx("div", { className: `mb-6 pb-6 border-b border-border ${className}`, children: jsxs("div", { className: "flex flex-wrap gap-4 items-end", children: [jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Source" }), jsx(ChangeSourceToggle, { value: filters.changeSource || "all", onChange: handleChangeSourceChange, disabled })] }), jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Kind" }), jsx(MultiCombobox, { options: resourceKinds.filter((facet) => facet.value).map((facet) => ({
    value: facet.value,
    label: facet.value,
    count: facet.count
  })), values: filters.resourceKinds || [], onValuesChange: handleResourceKindsChange, placeholder: "All", searchPlaceholder: "Search kinds...", disabled, loading: facetsLoading, className: "min-w-[140px]" })] }), jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Actor" }), jsx(MultiCombobox, { options: actorNames.filter((facet) => facet.value).map((facet) => ({
    value: facet.value,
    label: facet.value,
    count: facet.count
  })), values: filters.actorNames || [], onValuesChange: handleActorNamesChange, placeholder: "All", searchPlaceholder: "Search actors...", disabled, loading: facetsLoading, className: "min-w-[140px]" })] }), jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Namespace" }), jsx(MultiCombobox, { options: resourceNamespaces.filter((facet) => facet.value).map((facet) => ({
    value: facet.value,
    label: facet.value,
    count: facet.count
  })), values: filters.resourceNamespaces || [], onValuesChange: handleResourceNamespacesChange, placeholder: "All", searchPlaceholder: "Search namespaces...", disabled, loading: facetsLoading, className: "min-w-[140px]" })] }), jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "API Group" }), jsx(MultiCombobox, { options: apiGroups.filter((facet) => facet.value).map((facet) => ({
    value: facet.value,
    label: facet.value,
    count: facet.count
  })), values: filters.apiGroups || [], onValuesChange: handleApiGroupsChange, placeholder: "All", searchPlaceholder: "Search API groups...", disabled, loading: facetsLoading, className: "min-w-[140px]" })] }), jsxs("div", { className: "flex flex-col gap-2", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Name" }), jsxs("div", { className: "relative", children: [jsx(Input, { type: "text", value: resourceNameValue, onChange: handleResourceNameChange, placeholder: "Filter by name...", className: "min-w-[140px] pr-8", disabled }), resourceNameValue && jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6", onClick: handleResourceNameClear, disabled, "aria-label": "Clear resource name", children: "×" })] })] }), showSearch && jsxs("div", { className: "flex flex-col gap-2 flex-1 min-w-[180px]", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Search" }), jsxs("div", { className: "relative", children: [jsx(Input, { type: "text", value: searchValue, onChange: handleSearchChange, placeholder: "Search activities...", className: "pr-8", disabled }), searchValue && jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6", onClick: handleSearchClear, disabled, "aria-label": "Clear search", children: "×" })] })] }), jsxs("div", { className: "flex flex-col gap-2 ml-auto", children: [jsx(Label$1, { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Time Range" }), jsx(TimeRangeDropdown, { presets: TIME_PRESETS, selectedPreset, onPresetSelect: handleTimePresetSelect, onCustomRangeApply: handleCustomRangeApply, customStart, customEnd, disabled, displayLabel: getTimeRangeLabel() })] })] }) });
}
function ActivityFeed({ client, initialFilters = { changeSource: "human" }, initialTimeRange = { start: "now-7d" }, pageSize = 30, onResourceClick, onActivityClick, compact = false, resourceUid, showFilters = true, className = "", infiniteScroll = true, loadMoreThreshold = 200, onCreatePolicy, enableStreaming = false }) {
  const mergedInitialFilters = {
    ...initialFilters,
    resourceUid: resourceUid || initialFilters.resourceUid
  };
  const { activities, isLoading, error, hasMore, filters, timeRange, refresh, loadMore, setFilters, setTimeRange, isStreaming, startStreaming, stopStreaming, newActivitiesCount } = useActivityFeed({
    client,
    initialFilters: mergedInitialFilters,
    initialTimeRange,
    pageSize,
    enableStreaming,
    autoStartStreaming: true
  });
  const scrollContainerRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);
  const [hasPolicies, setHasPolicies] = useState(null);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  useEffect(() => {
    const checkPolicies = async () => {
      var _a;
      try {
        const policyList = await client.listPolicies();
        setHasPolicies((((_a = policyList.items) == null ? void 0 : _a.length) ?? 0) > 0);
      } catch {
        setHasPolicies(true);
      } finally {
        setPoliciesLoading(false);
      }
    };
    checkPolicies();
  }, [client]);
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    if (!infiniteScroll || !loadMoreTriggerRef.current)
      return;
    const observer = new IntersectionObserver((entries) => {
      const entry2 = entries[0];
      if (entry2.isIntersecting && hasMore && !isLoading) {
        loadMore();
      }
    }, {
      root: scrollContainerRef.current,
      rootMargin: `${loadMoreThreshold}px`,
      threshold: 0
    });
    observer.observe(loadMoreTriggerRef.current);
    return () => {
      observer.disconnect();
    };
  }, [infiniteScroll, hasMore, isLoading, loadMore, loadMoreThreshold]);
  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, [setFilters]);
  const handleTimeRangeChange = useCallback((newTimeRange) => {
    setTimeRange(newTimeRange);
  }, [setTimeRange]);
  const handleLoadMoreClick = useCallback(() => {
    loadMore();
  }, [loadMore]);
  const handleStreamingToggle = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
    } else {
      startStreaming();
    }
  }, [isStreaming, startStreaming, stopStreaming]);
  const containerClasses = compact ? `p-4 shadow-none border-border ${className}` : `p-6 ${className}`;
  const listClasses = compact ? "max-h-[40vh] overflow-y-auto pr-2" : "max-h-[60vh] overflow-y-auto pr-2";
  return jsxs(Card, { className: containerClasses, children: [enableStreaming && jsxs("div", { className: "flex items-center justify-between mb-4 pb-3 border-b border-border", children: [jsxs("div", { className: "flex items-center gap-3", children: [jsx("h3", { className: "text-sm font-medium text-foreground m-0", children: "Activity Feed" }), isStreaming && jsxs("div", { className: "flex items-center gap-2", children: [jsxs("span", { className: "relative flex h-2 w-2", children: [jsx("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 dark:bg-green-500 opacity-75" }), jsx("span", { className: "relative inline-flex rounded-full h-2 w-2 bg-green-500 dark:bg-green-400" })] }), jsx("span", { className: "text-xs text-muted-foreground", children: "Live" })] }), newActivitiesCount > 0 && jsxs(Badge, { variant: "secondary", className: "text-xs", children: ["+", newActivitiesCount, " new"] })] }), jsx(Button, { variant: "ghost", size: "sm", onClick: handleStreamingToggle, className: "text-xs", children: isStreaming ? jsxs(Fragment, { children: [jsxs("svg", { className: "w-4 h-4 mr-1.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [jsx("rect", { x: "6", y: "4", width: "4", height: "16" }), jsx("rect", { x: "14", y: "4", width: "4", height: "16" })] }), "Pause"] }) : jsxs(Fragment, { children: [jsx("svg", { className: "w-4 h-4 mr-1.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: jsx("polygon", { points: "5,3 19,12 5,21", fill: "currentColor" }) }), "Resume"] }) })] }), showFilters && jsx(ActivityFeedFilters, { client, filters, timeRange, onFiltersChange: handleFiltersChange, onTimeRangeChange: handleTimeRangeChange, disabled: isLoading, showSearch: !compact, showAdvancedFilters: false }), error && jsxs(Alert, { variant: "destructive", className: "mb-4 flex justify-between items-center gap-4", children: [jsx(AlertDescription, { className: "text-sm", children: error.message }), jsx(Button, { variant: "outline", size: "sm", onClick: refresh, children: "Retry" })] }), !policiesLoading && hasPolicies === false && jsxs("div", { className: "flex flex-col items-center py-12 px-8 text-center bg-muted border border-dashed border-border rounded-xl mb-4", children: [jsx("div", { className: "flex justify-center mb-4 text-muted-foreground", children: jsxs("svg", { width: "56", height: "56", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [jsx("path", { d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" }), jsx("rect", { x: "9", y: "3", width: "6", height: "4", rx: "1" }), jsx("path", { d: "M9 12h6" }), jsx("path", { d: "M9 16h6" })] }) }), jsx("h3", { className: "m-0 mb-2 text-lg font-semibold text-foreground leading-snug", children: "Get started with activity logging" }), jsx("p", { className: "m-0 mb-6 text-sm leading-relaxed text-muted-foreground max-w-[400px]", children: "Activity policies define which resources to track and how to summarize changes. Create your first policy to start seeing activity logs here." }), onCreatePolicy && jsx(Button, { onClick: onCreatePolicy, children: "Create Policy" })] }), jsxs("div", { className: listClasses, ref: scrollContainerRef, children: [activities.length === 0 && !isLoading && hasPolicies !== false && jsxs("div", { className: "py-12 text-center text-muted-foreground", children: [jsx("p", { className: "m-0", children: "No activities found" }), jsx("p", { className: "text-sm text-muted-foreground mt-2 m-0", children: "Try adjusting your filters or time range" })] }), activities.map((activity, index2) => {
    var _a, _b;
    return jsx(ActivityFeedItem, { activity, onResourceClick, onActivityClick, compact, isNew: enableStreaming && index2 < newActivitiesCount }, ((_a = activity.metadata) == null ? void 0 : _a.uid) || ((_b = activity.metadata) == null ? void 0 : _b.name));
  }), infiniteScroll && hasMore && jsx("div", { ref: loadMoreTriggerRef, className: "h-px mt-4" }), isLoading && jsxs("div", { className: "flex items-center justify-center gap-3 py-8 text-muted-foreground text-sm", children: [jsx("div", { className: "w-5 h-5 border-[3px] border-muted border-t-primary rounded-full animate-spin" }), jsx("span", { children: "Loading activities..." })] }), !infiniteScroll && hasMore && !isLoading && jsx("div", { className: "flex justify-center p-4 mt-4", children: jsx(Button, { onClick: handleLoadMoreClick, children: "Load more" }) }), !hasMore && activities.length > 0 && !isLoading && jsx("div", { className: "text-center py-6 text-muted-foreground text-sm border-t border-border mt-4", children: "No more activities to load" })] })] });
}
function buildHeaderTitle(filter) {
  if (filter.uid) {
    return `Resource History (UID: ${filter.uid.substring(0, 8)}...)`;
  }
  const parts = [];
  if (filter.kind) {
    parts.push(filter.kind);
  }
  if (filter.name) {
    parts.push(filter.name);
  }
  if (filter.namespace) {
    parts.push(`in ${filter.namespace}`);
  }
  if (filter.apiGroup) {
    parts.push(`(${filter.apiGroup})`);
  }
  return parts.length > 0 ? parts.join(" ") : "Resource History";
}
function ResourceHistoryView({ client, resourceFilter, startTime = "now-30d", limit = 50, showHeader = true, compact = false, onActivityClick, onResourceClick, className }) {
  const activityFilters = useMemo(() => {
    const filters = {};
    if (resourceFilter.uid) {
      filters.resourceUid = resourceFilter.uid;
    } else {
      if (resourceFilter.apiGroup) {
        filters.apiGroups = [resourceFilter.apiGroup];
      }
      if (resourceFilter.kind) {
        filters.resourceKinds = [resourceFilter.kind];
      }
      if (resourceFilter.namespace) {
        filters.resourceNamespaces = [resourceFilter.namespace];
      }
      if (resourceFilter.name) {
        filters.resourceName = resourceFilter.name;
      }
    }
    return filters;
  }, [resourceFilter]);
  const filterKey = useMemo(() => {
    return JSON.stringify(resourceFilter);
  }, [resourceFilter]);
  const { activities, isLoading, error, hasMore, refresh, loadMore } = useActivityFeed({
    client,
    initialFilters: activityFilters,
    initialTimeRange: { start: startTime },
    pageSize: limit,
    enableStreaming: false
  });
  useEffect(() => {
    refresh();
  }, [filterKey]);
  const handleLoadMore = useCallback(() => {
    loadMore();
  }, [loadMore]);
  const headerTitle = buildHeaderTitle(resourceFilter);
  const hasValidFilter = resourceFilter.uid || resourceFilter.apiGroup || resourceFilter.kind || resourceFilter.namespace || resourceFilter.name;
  return jsxs(Card, { className: cn(compact ? "p-0 shadow-none border-0" : "", className), children: [showHeader && jsx(CardHeader, { className: cn(compact ? "px-0 pt-0 pb-3" : "pb-4"), children: jsxs(CardTitle, { className: "text-base font-semibold text-foreground flex items-center gap-2", children: [jsx("svg", { className: "w-4 h-4 text-muted-foreground", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }) }), headerTitle] }) }), jsxs(CardContent, { className: cn(compact ? "p-0" : ""), children: [!hasValidFilter && jsxs("div", { className: "py-12 text-center text-muted-foreground", children: [jsx("svg", { className: "w-12 h-12 mx-auto mb-3 text-muted-foreground/50", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }), jsx("p", { className: "m-0 text-sm", children: "No resource filter specified" }), jsx("p", { className: "text-xs text-muted-foreground mt-1 m-0", children: "Provide at least one filter criterion to view resource history" })] }), hasValidFilter && error && jsx(Alert, { variant: "destructive", className: "mb-4", children: jsxs(AlertDescription, { className: "flex items-center justify-between gap-4", children: [jsx("span", { className: "text-sm", children: error.message }), jsx(Button, { variant: "outline", size: "sm", onClick: refresh, children: "Retry" })] }) }), hasValidFilter && isLoading && activities.length === 0 && jsxs("div", { className: "flex items-center justify-center gap-3 py-12 text-muted-foreground text-sm", children: [jsx("div", { className: "w-5 h-5 border-[3px] border-muted border-t-primary rounded-full animate-spin" }), jsx("span", { children: "Loading history..." })] }), hasValidFilter && !isLoading && activities.length === 0 && !error && jsxs("div", { className: "py-12 text-center text-muted-foreground", children: [jsx("svg", { className: "w-12 h-12 mx-auto mb-3 text-muted-foreground/50", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" }) }), jsx("p", { className: "m-0 text-sm", children: "No history found for this resource" }), jsx("p", { className: "text-xs text-muted-foreground mt-1 m-0", children: "Changes will appear here once activity policies are configured" })] }), hasValidFilter && activities.length > 0 && jsxs("div", { className: "relative", children: [activities.map((activity, index2) => {
    var _a, _b;
    const activityId = ((_a = activity.metadata) == null ? void 0 : _a.uid) || ((_b = activity.metadata) == null ? void 0 : _b.name) || String(index2);
    return jsx(ActivityFeedItem, { activity, variant: "timeline", compact, isFirst: index2 === 0, isLast: index2 === activities.length - 1 && !hasMore, onActivityClick, onResourceClick }, activityId);
  }), isLoading && activities.length > 0 && jsx("div", { className: cn("relative", compact ? "pl-8" : "pl-10"), children: jsxs("div", { className: "flex items-center gap-3 py-4 text-muted-foreground text-sm", children: [jsx("div", { className: "w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" }), jsx("span", { children: "Loading more..." })] }) }), hasMore && !isLoading && jsxs("div", { className: cn("relative", compact ? "pl-8" : "pl-10"), children: [jsx("div", { className: cn("absolute w-0.5 bg-border", compact ? "left-[11px] top-0 h-4" : "left-[15px] top-0 h-5") }), jsx(Button, { variant: "ghost", size: "sm", onClick: handleLoadMore, className: "text-muted-foreground hover:text-foreground mt-2", children: "Load more history" })] })] }), hasValidFilter && activities.length > 0 && jsxs("div", { className: cn("text-xs text-muted-foreground mt-4 pt-3 border-t border-border", compact ? "" : ""), children: ["Showing ", activities.length, " event", activities.length !== 1 ? "s" : "", hasMore && " (more available)"] })] })] });
}
const FILTER_DEBOUNCE_MS = 300;
function buildFieldSelector(filters) {
  const selectors = [];
  if (filters.eventType && filters.eventType !== "all") {
    selectors.push(`type=${filters.eventType}`);
  }
  if (filters.involvedKinds && filters.involvedKinds.length === 1) {
    selectors.push(`involvedObject.kind=${filters.involvedKinds[0]}`);
  }
  if (filters.involvedName) {
    selectors.push(`involvedObject.name=${filters.involvedName}`);
  }
  if (filters.reasons && filters.reasons.length === 1) {
    selectors.push(`reason=${filters.reasons[0]}`);
  }
  if (filters.sourceComponents && filters.sourceComponents.length === 1) {
    selectors.push(`source.component=${filters.sourceComponents[0]}`);
  }
  if (filters.namespaces && filters.namespaces.length === 1) {
    selectors.push(`metadata.namespace=${filters.namespaces[0]}`);
  }
  return selectors.length > 0 ? selectors.join(",") : void 0;
}
function filterEventsClientSide(events, filters) {
  return events.filter((event) => {
    var _a, _b, _c;
    if (filters.involvedKinds && filters.involvedKinds.length > 1) {
      if (!filters.involvedKinds.includes(((_a = event.involvedObject) == null ? void 0 : _a.kind) || "")) {
        return false;
      }
    }
    if (filters.reasons && filters.reasons.length > 1) {
      if (!filters.reasons.includes(event.reason || "")) {
        return false;
      }
    }
    if (filters.sourceComponents && filters.sourceComponents.length > 1) {
      if (!filters.sourceComponents.includes(((_b = event.source) == null ? void 0 : _b.component) || "")) {
        return false;
      }
    }
    if (filters.namespaces && filters.namespaces.length > 1) {
      if (!filters.namespaces.includes(((_c = event.metadata) == null ? void 0 : _c.namespace) || "")) {
        return false;
      }
    }
    return true;
  });
}
function useEventsFeed({ client, initialFilters = {}, initialTimeRange = { start: "now-24h" }, pageSize = 50, namespace, enableStreaming = false, autoStartStreaming = true }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [continueCursor, setContinueCursor] = useState();
  const [filters, setFilters] = useState(initialFilters);
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [isStreaming, setIsStreaming] = useState(false);
  const [newEventsCount, setNewEventsCount] = useState(0);
  const resourceVersionRef = useRef();
  const watchStopRef = useRef(null);
  const shouldRestartStreamingRef = useRef(false);
  const hasInitialLoadRef = useRef(false);
  const filterDebounceRef = useRef(null);
  const buildParams = useCallback((cursor) => {
    return {
      namespace,
      fieldSelector: buildFieldSelector(filters),
      limit: pageSize,
      continue: cursor
    };
  }, [filters, namespace, pageSize]);
  const handleWatchEvent = useCallback((event) => {
    var _a, _b;
    if (event.type === "ERROR") {
      console.error("Watch error:", event.object);
      return;
    }
    if (event.type === "BOOKMARK") {
      if ((_a = event.object.metadata) == null ? void 0 : _a.resourceVersion) {
        resourceVersionRef.current = event.object.metadata.resourceVersion;
      }
      return;
    }
    if ((_b = event.object.metadata) == null ? void 0 : _b.resourceVersion) {
      resourceVersionRef.current = event.object.metadata.resourceVersion;
    }
    const matchesFilters = filterEventsClientSide([event.object], filters).length > 0;
    if (!matchesFilters) {
      return;
    }
    if (event.type === "ADDED") {
      setEvents((prev) => {
        const exists = prev.some((e) => {
          var _a2, _b2, _c, _d;
          return ((_a2 = e.metadata) == null ? void 0 : _a2.name) === ((_b2 = event.object.metadata) == null ? void 0 : _b2.name) && ((_c = e.metadata) == null ? void 0 : _c.namespace) === ((_d = event.object.metadata) == null ? void 0 : _d.namespace);
        });
        if (exists) {
          return prev;
        }
        return [event.object, ...prev];
      });
      setNewEventsCount((prev) => prev + 1);
    } else if (event.type === "MODIFIED") {
      setEvents((prev) => prev.map((e) => {
        var _a2, _b2, _c, _d;
        return ((_a2 = e.metadata) == null ? void 0 : _a2.name) === ((_b2 = event.object.metadata) == null ? void 0 : _b2.name) && ((_c = e.metadata) == null ? void 0 : _c.namespace) === ((_d = event.object.metadata) == null ? void 0 : _d.namespace) ? event.object : e;
      }));
    } else if (event.type === "DELETED") {
      setEvents((prev) => prev.filter((e) => {
        var _a2, _b2, _c, _d;
        return !(((_a2 = e.metadata) == null ? void 0 : _a2.name) === ((_b2 = event.object.metadata) == null ? void 0 : _b2.name) && ((_c = e.metadata) == null ? void 0 : _c.namespace) === ((_d = event.object.metadata) == null ? void 0 : _d.namespace));
      }));
    }
  }, [filters]);
  const startStreaming = useCallback(() => {
    if (watchStopRef.current) {
      return;
    }
    const params = buildParams();
    const { stop } = client.watchEvents(params, {
      resourceVersion: resourceVersionRef.current,
      onEvent: handleWatchEvent,
      onError: (err) => {
        console.error("Watch stream error:", err);
        setError(err);
        setIsStreaming(false);
        watchStopRef.current = null;
      },
      onClose: () => {
        setIsStreaming(false);
        watchStopRef.current = null;
      }
    });
    watchStopRef.current = stop;
    setIsStreaming(true);
    setNewEventsCount(0);
  }, [client, buildParams, handleWatchEvent]);
  const stopStreaming = useCallback(() => {
    if (watchStopRef.current) {
      watchStopRef.current();
      watchStopRef.current = null;
    }
    setIsStreaming(false);
  }, []);
  const refresh = useCallback(async () => {
    var _a, _b;
    setIsLoading(true);
    setError(null);
    setNewEventsCount(0);
    try {
      const params = buildParams();
      const result = await client.listEvents(params);
      const filteredEvents = filterEventsClientSide(result.items || [], filters);
      setEvents(filteredEvents);
      setContinueCursor((_a = result.metadata) == null ? void 0 : _a.continue);
      if ((_b = result.metadata) == null ? void 0 : _b.resourceVersion) {
        resourceVersionRef.current = result.metadata.resourceVersion;
      }
      hasInitialLoadRef.current = true;
      if (shouldRestartStreamingRef.current && enableStreaming) {
        shouldRestartStreamingRef.current = false;
        setTimeout(() => {
          if (watchStopRef.current === null) {
          }
        }, 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      shouldRestartStreamingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [client, buildParams, filters, enableStreaming]);
  const loadMore = useCallback(async () => {
    var _a;
    if (!continueCursor || isLoading) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const params = buildParams(continueCursor);
      const result = await client.listEvents(params);
      const filteredEvents = filterEventsClientSide(result.items || [], filters);
      setEvents((prev) => [...prev, ...filteredEvents]);
      setContinueCursor((_a = result.metadata) == null ? void 0 : _a.continue);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, buildParams, continueCursor, isLoading, filters]);
  const updateFilters = useCallback((newFilters) => {
    if (isStreaming) {
      shouldRestartStreamingRef.current = true;
      stopStreaming();
    }
    setFilters(newFilters);
    setEvents([]);
    setContinueCursor(void 0);
    resourceVersionRef.current = void 0;
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }
    filterDebounceRef.current = setTimeout(() => {
      filterDebounceRef.current = null;
    }, FILTER_DEBOUNCE_MS);
  }, [stopStreaming, isStreaming]);
  const updateTimeRange = useCallback((newTimeRange) => {
    if (isStreaming) {
      shouldRestartStreamingRef.current = true;
      stopStreaming();
    }
    setTimeRange(newTimeRange);
    setEvents([]);
    setContinueCursor(void 0);
    resourceVersionRef.current = void 0;
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }
    filterDebounceRef.current = setTimeout(() => {
      filterDebounceRef.current = null;
    }, FILTER_DEBOUNCE_MS);
  }, [stopStreaming, isStreaming]);
  const reset = useCallback(() => {
    stopStreaming();
    setEvents([]);
    setError(null);
    setContinueCursor(void 0);
    setFilters(initialFilters);
    setTimeRange(initialTimeRange);
    setNewEventsCount(0);
    resourceVersionRef.current = void 0;
  }, [initialFilters, initialTimeRange, stopStreaming]);
  useEffect(() => {
    if (!hasInitialLoadRef.current) {
      return;
    }
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }
    filterDebounceRef.current = setTimeout(() => {
      filterDebounceRef.current = null;
      refresh();
    }, FILTER_DEBOUNCE_MS);
    return () => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
        filterDebounceRef.current = null;
      }
    };
  }, [filters, timeRange]);
  useEffect(() => {
    if (enableStreaming && autoStartStreaming && events.length > 0 && !isStreaming && !isLoading) {
      startStreaming();
    }
  }, [enableStreaming, autoStartStreaming, events.length, isStreaming, isLoading, startStreaming]);
  useEffect(() => {
    if (enableStreaming && shouldRestartStreamingRef.current && events.length > 0 && !isStreaming && !isLoading) {
      shouldRestartStreamingRef.current = false;
      startStreaming();
    }
  }, [enableStreaming, events.length, isStreaming, isLoading, startStreaming]);
  useEffect(() => {
    return () => {
      if (watchStopRef.current) {
        watchStopRef.current();
      }
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
      }
    };
  }, []);
  const hasMore = useMemo(() => !!continueCursor, [continueCursor]);
  return {
    events,
    isLoading,
    error,
    hasMore,
    filters,
    timeRange,
    refresh,
    loadMore,
    setFilters: updateFilters,
    setTimeRange: updateTimeRange,
    reset,
    isStreaming,
    startStreaming,
    stopStreaming,
    newEventsCount
  };
}
function formatTimestamp$1(timestamp) {
  if (!timestamp)
    return "Unknown time";
  try {
    const date = new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return timestamp;
  }
}
function formatTimestampFull(timestamp) {
  if (!timestamp)
    return "Unknown time";
  try {
    return format(new Date(timestamp), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return timestamp;
  }
}
function getEventTypeBadge(type) {
  if (type === "Warning") {
    return {
      variant: "default",
      className: "bg-amber-500 hover:bg-amber-500/80 text-white"
    };
  }
  return {
    variant: "default",
    className: "bg-green-500 hover:bg-green-500/80 text-white"
  };
}
function formatInvolvedObject(obj) {
  if (!obj)
    return "Unknown";
  const parts = [obj.kind, obj.namespace, obj.name].filter(Boolean);
  if (obj.namespace && obj.name) {
    return `${obj.kind || "Object"} ${obj.namespace}/${obj.name}`;
  }
  if (obj.name) {
    return `${obj.kind || "Object"} ${obj.name}`;
  }
  return parts.join("/") || "Unknown";
}
function EventsFeedItem({ event, onObjectClick, onEventClick, isSelected = false, className = "", compact = false, isNew = false }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { involvedObject, reason, message: message2, type, source, count: count2, firstTimestamp, lastTimestamp, metadata } = event;
  const eventTypeBadge = getEventTypeBadge(type);
  const handleClick = () => {
    onEventClick == null ? void 0 : onEventClick(event);
  };
  const handleObjectClick = (e) => {
    e.stopPropagation();
    if (involvedObject && onObjectClick) {
      onObjectClick(involvedObject);
    }
  };
  const toggleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };
  const displayTimestamp = lastTimestamp || firstTimestamp || (metadata == null ? void 0 : metadata.creationTimestamp);
  return jsxs(Card, { className: cn("cursor-pointer transition-all duration-200", "hover:border-rose-300 hover:shadow-sm hover:-translate-y-px dark:hover:border-rose-600", compact ? "p-3 mb-2" : "p-4 mb-3", isSelected && "border-rose-300 bg-rose-50 shadow-md dark:border-rose-600 dark:bg-rose-950/50", isNew && "border-l-4 border-l-green-500 bg-green-50/50 dark:border-l-green-400 dark:bg-green-950/30", className), onClick: handleClick, children: [jsxs("div", { className: "flex gap-4", children: [jsx("div", { className: "shrink-0", children: jsx(Badge, { variant: eventTypeBadge.variant, className: cn("text-xs font-medium", eventTypeBadge.className), children: type || "Normal" }) }), jsxs("div", { className: "flex-1 min-w-0", children: [jsxs("div", { className: "flex justify-between items-start gap-4 mb-2", children: [jsx("div", { className: cn("leading-relaxed text-foreground", compact ? "text-sm" : "text-[0.9375rem]"), children: message2 || "No message" }), jsx("span", { className: "text-xs text-muted-foreground whitespace-nowrap", title: formatTimestampFull(displayTimestamp), children: formatTimestamp$1(displayTimestamp) })] }), jsxs("div", { className: "flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground", children: [reason && jsx(Badge, { variant: "outline", className: "text-xs font-normal", children: reason }), jsx("button", { type: "button", onClick: handleObjectClick, className: "text-primary hover:underline cursor-pointer bg-transparent border-none p-0", children: formatInvolvedObject(involvedObject) }), (source == null ? void 0 : source.component) && jsxs("span", { className: "text-muted-foreground", children: ["via ", source.component] }), count2 && count2 > 1 && jsxs("span", { className: "text-muted-foreground", children: ["(", count2, " times)"] }), jsx(Button, { variant: "ghost", size: "sm", className: "ml-auto h-auto py-0 px-1 text-xs text-muted-foreground hover:text-foreground", onClick: toggleExpand, "aria-expanded": isExpanded, children: isExpanded ? "▾ Less" : "▸ More" })] })] })] }), isExpanded && jsx("div", { className: "mt-4 pt-4 border-t border-border", children: jsxs("div", { className: "grid grid-cols-2 gap-x-6 gap-y-2 text-sm", children: [(metadata == null ? void 0 : metadata.namespace) && jsxs(Fragment, { children: [jsx("span", { className: "text-muted-foreground", children: "Namespace:" }), jsx("span", { className: "font-mono text-foreground", children: metadata.namespace })] }), (metadata == null ? void 0 : metadata.name) && jsxs(Fragment, { children: [jsx("span", { className: "text-muted-foreground", children: "Event Name:" }), jsx("span", { className: "font-mono text-foreground truncate", title: metadata.name, children: metadata.name })] }), (involvedObject == null ? void 0 : involvedObject.uid) && jsxs(Fragment, { children: [jsx("span", { className: "text-muted-foreground", children: "Object UID:" }), jsx("span", { className: "font-mono text-foreground truncate", title: involvedObject.uid, children: involvedObject.uid })] }), (involvedObject == null ? void 0 : involvedObject.fieldPath) && jsxs(Fragment, { children: [jsx("span", { className: "text-muted-foreground", children: "Field Path:" }), jsx("span", { className: "font-mono text-foreground", children: involvedObject.fieldPath })] }), (source == null ? void 0 : source.host) && jsxs(Fragment, { children: [jsx("span", { className: "text-muted-foreground", children: "Source Host:" }), jsx("span", { className: "font-mono text-foreground", children: source.host })] }), firstTimestamp && jsxs(Fragment, { children: [jsx("span", { className: "text-muted-foreground", children: "First Seen:" }), jsx("span", { className: "text-foreground", children: formatTimestampFull(firstTimestamp) })] }), lastTimestamp && jsxs(Fragment, { children: [jsx("span", { className: "text-muted-foreground", children: "Last Seen:" }), jsx("span", { className: "text-foreground", children: formatTimestampFull(lastTimestamp) })] })] }) })] });
}
function useEventFacets(client, timeRange, _filters = {}) {
  const [involvedKinds, setInvolvedKinds] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [sourceComponents, setSourceComponents] = useState([]);
  const [namespaces, setNamespaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastFetchedRef = useRef(null);
  const fetchFacets = useCallback(async () => {
    var _a;
    const cacheKey = `${timeRange.start}-${timeRange.end || "now"}`;
    if (lastFetchedRef.current === cacheKey) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.queryEventFacets({
        timeRange: {
          start: timeRange.start,
          end: timeRange.end
        },
        facets: [
          { field: "involvedObject.kind", limit: 50 },
          { field: "reason", limit: 50 },
          { field: "type", limit: 10 },
          { field: "source.component", limit: 50 },
          { field: "namespace", limit: 50 }
        ]
      });
      const facets = ((_a = result.status) == null ? void 0 : _a.facets) || [];
      const kindFacet = facets.find((f) => f.field === "involvedObject.kind");
      setInvolvedKinds((kindFacet == null ? void 0 : kindFacet.values) || []);
      const reasonFacet = facets.find((f) => f.field === "reason");
      setReasons((reasonFacet == null ? void 0 : reasonFacet.values) || []);
      const typeFacet = facets.find((f) => f.field === "type");
      setEventTypes((typeFacet == null ? void 0 : typeFacet.values) || []);
      const componentFacet = facets.find((f) => f.field === "source.component");
      setSourceComponents((componentFacet == null ? void 0 : componentFacet.values) || []);
      const namespaceFacet = facets.find((f) => f.field === "namespace");
      setNamespaces((namespaceFacet == null ? void 0 : namespaceFacet.values) || []);
      lastFetchedRef.current = cacheKey;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, timeRange.start, timeRange.end]);
  useEffect(() => {
    fetchFacets();
  }, [fetchFacets]);
  const refresh = useCallback(async () => {
    lastFetchedRef.current = null;
    await fetchFacets();
  }, [fetchFacets]);
  return {
    involvedKinds,
    reasons,
    eventTypes,
    sourceComponents,
    namespaces,
    isLoading,
    error,
    refresh
  };
}
const OPTIONS = [
  {
    value: "all",
    label: "All",
    description: "Show all events"
  },
  {
    value: "Normal",
    label: "Normal",
    description: "Show only normal events"
  },
  {
    value: "Warning",
    label: "Warning",
    description: "Show only warning events"
  }
];
function EventTypeToggle({ value, onChange, className = "", disabled = false }) {
  return jsx("div", { className: cn("inline-flex border border-input rounded-md overflow-hidden", className), role: "group", "aria-label": "Filter by event type", children: OPTIONS.map((option, index2) => jsx(Button, { type: "button", variant: "ghost", className: cn("rounded-none px-4 py-2 text-sm font-medium transition-all duration-200", index2 < OPTIONS.length - 1 && "border-r border-input", value === option.value ? option.value === "Warning" ? "bg-amber-500 text-white hover:bg-amber-500/90" : option.value === "Normal" ? "bg-green-500 text-white hover:bg-green-500/90" : "bg-[#BF9595] text-[#0C1D31] hover:bg-[#BF9595]/90" : "bg-muted text-foreground hover:bg-muted/80"), onClick: () => onChange(option.value), disabled, "aria-pressed": value === option.value, title: option.description, children: option.label }, option.value)) });
}
function EventsFeedFilters({ client, filters, timeRange, onFiltersChange, onTimeRangeChange, disabled = false, className = "" }) {
  const { involvedKinds, reasons, sourceComponents, namespaces, isLoading: facetsLoading } = useEventFacets(client, timeRange, filters);
  const handleEventTypeChange = useCallback((value) => {
    onFiltersChange({
      ...filters,
      eventType: value === "all" ? void 0 : value
    });
  }, [filters, onFiltersChange]);
  const handleTimeRangeChange = useCallback((start, end) => {
    onTimeRangeChange({ start, end });
  }, [onTimeRangeChange]);
  return jsxs("div", { className: cn("space-y-4 mb-4", className), children: [jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [jsx(EventTypeToggle, { value: filters.eventType || "all", onChange: handleEventTypeChange, disabled }), jsx(DateTimeRangePicker, { initialRange: { start: timeRange.start, end: timeRange.end || "" }, onChange: (range) => handleTimeRangeChange(range.start, range.end || void 0) })] }), jsxs("div", { className: "flex flex-wrap gap-4", children: [jsxs("div", { className: "relative", children: [jsx("label", { className: "text-xs font-medium text-muted-foreground mb-1 block", children: "Namespace" }), jsx("select", { multiple: true, className: cn("min-w-[150px] h-[80px] text-sm rounded-md border border-input bg-background px-2 py-1", "focus:outline-none focus:ring-2 focus:ring-ring", disabled && "opacity-50 cursor-not-allowed"), disabled: disabled || facetsLoading, value: filters.namespaces || [], onChange: (e) => {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    onFiltersChange({ ...filters, namespaces: selected.length > 0 ? selected : void 0 });
  }, children: namespaces.map((facet) => jsxs("option", { value: facet.value, children: [facet.value, " (", facet.count, ")"] }, facet.value)) })] }), jsxs("div", { className: "relative", children: [jsx("label", { className: "text-xs font-medium text-muted-foreground mb-1 block", children: "Involved Kind" }), jsx("select", { multiple: true, className: cn("min-w-[150px] h-[80px] text-sm rounded-md border border-input bg-background px-2 py-1", "focus:outline-none focus:ring-2 focus:ring-ring", disabled && "opacity-50 cursor-not-allowed"), disabled: disabled || facetsLoading, value: filters.involvedKinds || [], onChange: (e) => {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    onFiltersChange({ ...filters, involvedKinds: selected.length > 0 ? selected : void 0 });
  }, children: involvedKinds.map((facet) => jsxs("option", { value: facet.value, children: [facet.value, " (", facet.count, ")"] }, facet.value)) })] }), jsxs("div", { className: "relative", children: [jsx("label", { className: "text-xs font-medium text-muted-foreground mb-1 block", children: "Reason" }), jsx("select", { multiple: true, className: cn("min-w-[150px] h-[80px] text-sm rounded-md border border-input bg-background px-2 py-1", "focus:outline-none focus:ring-2 focus:ring-ring", disabled && "opacity-50 cursor-not-allowed"), disabled: disabled || facetsLoading, value: filters.reasons || [], onChange: (e) => {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    onFiltersChange({ ...filters, reasons: selected.length > 0 ? selected : void 0 });
  }, children: reasons.map((facet) => jsxs("option", { value: facet.value, children: [facet.value, " (", facet.count, ")"] }, facet.value)) })] }), jsxs("div", { className: "relative", children: [jsx("label", { className: "text-xs font-medium text-muted-foreground mb-1 block", children: "Source" }), jsx("select", { multiple: true, className: cn("min-w-[150px] h-[80px] text-sm rounded-md border border-input bg-background px-2 py-1", "focus:outline-none focus:ring-2 focus:ring-ring", disabled && "opacity-50 cursor-not-allowed"), disabled: disabled || facetsLoading, value: filters.sourceComponents || [], onChange: (e) => {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    onFiltersChange({ ...filters, sourceComponents: selected.length > 0 ? selected : void 0 });
  }, children: sourceComponents.map((facet) => jsxs("option", { value: facet.value, children: [facet.value, " (", facet.count, ")"] }, facet.value)) })] })] })] });
}
function EventsFeed({ client, initialFilters = {}, initialTimeRange = { start: "now-24h" }, pageSize = 50, onObjectClick, onEventClick, compact = false, namespace, showFilters = true, className = "", infiniteScroll = true, loadMoreThreshold = 200, enableStreaming = false }) {
  const { events, isLoading, error, hasMore, filters, timeRange, refresh, loadMore, setFilters, setTimeRange, isStreaming, startStreaming, stopStreaming, newEventsCount } = useEventsFeed({
    client,
    initialFilters,
    initialTimeRange,
    pageSize,
    namespace,
    enableStreaming,
    autoStartStreaming: true
  });
  const scrollContainerRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    if (!infiniteScroll || !loadMoreTriggerRef.current)
      return;
    const observer = new IntersectionObserver((entries) => {
      const entry2 = entries[0];
      if (entry2.isIntersecting && hasMore && !isLoading) {
        loadMore();
      }
    }, {
      root: scrollContainerRef.current,
      rootMargin: `${loadMoreThreshold}px`,
      threshold: 0
    });
    observer.observe(loadMoreTriggerRef.current);
    return () => {
      observer.disconnect();
    };
  }, [infiniteScroll, hasMore, isLoading, loadMore, loadMoreThreshold]);
  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, [setFilters]);
  const handleTimeRangeChange = useCallback((newTimeRange) => {
    setTimeRange(newTimeRange);
  }, [setTimeRange]);
  const handleLoadMoreClick = useCallback(() => {
    loadMore();
  }, [loadMore]);
  const handleStreamingToggle = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
    } else {
      startStreaming();
    }
  }, [isStreaming, startStreaming, stopStreaming]);
  const containerClasses = compact ? `p-4 shadow-none border-border ${className}` : `p-6 ${className}`;
  const listClasses = compact ? "max-h-[40vh] overflow-y-auto pr-2" : "max-h-[60vh] overflow-y-auto pr-2";
  return jsxs(Card, { className: containerClasses, children: [enableStreaming && jsxs("div", { className: "flex items-center justify-between mb-4 pb-3 border-b border-border", children: [jsxs("div", { className: "flex items-center gap-3", children: [jsx("h3", { className: "text-sm font-medium text-foreground m-0", children: "Events Feed" }), isStreaming && jsxs("div", { className: "flex items-center gap-2", children: [jsxs("span", { className: "relative flex h-2 w-2", children: [jsx("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 dark:bg-green-500 opacity-75" }), jsx("span", { className: "relative inline-flex rounded-full h-2 w-2 bg-green-500 dark:bg-green-400" })] }), jsx("span", { className: "text-xs text-muted-foreground", children: "Live" })] }), newEventsCount > 0 && jsxs(Badge, { variant: "secondary", className: "text-xs", children: ["+", newEventsCount, " new"] })] }), jsx(Button, { variant: "ghost", size: "sm", onClick: handleStreamingToggle, className: "text-xs", children: isStreaming ? jsxs(Fragment, { children: [jsxs("svg", { className: "w-4 h-4 mr-1.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [jsx("rect", { x: "6", y: "4", width: "4", height: "16" }), jsx("rect", { x: "14", y: "4", width: "4", height: "16" })] }), "Pause"] }) : jsxs(Fragment, { children: [jsx("svg", { className: "w-4 h-4 mr-1.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: jsx("polygon", { points: "5,3 19,12 5,21", fill: "currentColor" }) }), "Resume"] }) })] }), showFilters && jsx(EventsFeedFilters, { client, filters, timeRange, onFiltersChange: handleFiltersChange, onTimeRangeChange: handleTimeRangeChange, disabled: isLoading }), error && jsxs(Alert, { variant: "destructive", className: "mb-4 flex justify-between items-center gap-4", children: [jsx(AlertDescription, { className: "text-sm", children: error.message }), jsx(Button, { variant: "outline", size: "sm", onClick: refresh, children: "Retry" })] }), jsxs("div", { className: listClasses, ref: scrollContainerRef, children: [events.length === 0 && !isLoading && jsxs("div", { className: "py-12 text-center text-muted-foreground", children: [jsx("p", { className: "m-0", children: "No events found" }), jsx("p", { className: "text-sm text-muted-foreground mt-2 m-0", children: "Try adjusting your filters or time range" })] }), events.map((event, index2) => {
    var _a, _b, _c;
    return jsx(EventsFeedItem, { event, onObjectClick, onEventClick, compact, isNew: enableStreaming && index2 < newEventsCount }, `${(_a = event.metadata) == null ? void 0 : _a.namespace}-${(_b = event.metadata) == null ? void 0 : _b.name}-${(_c = event.metadata) == null ? void 0 : _c.uid}`);
  }), infiniteScroll && hasMore && jsx("div", { ref: loadMoreTriggerRef, className: "h-px mt-4" }), isLoading && jsxs("div", { className: "flex items-center justify-center gap-3 py-8 text-muted-foreground text-sm", children: [jsx("div", { className: "w-5 h-5 border-[3px] border-muted border-t-primary rounded-full animate-spin" }), jsx("span", { children: "Loading events..." })] }), !infiniteScroll && hasMore && !isLoading && jsx("div", { className: "flex justify-center p-4 mt-4", children: jsx(Button, { onClick: handleLoadMoreClick, children: "Load more" }) }), !hasMore && events.length > 0 && !isLoading && jsx("div", { className: "text-center py-6 text-muted-foreground text-sm border-t border-border mt-4", children: "No more events to load" })] })] });
}
function groupPoliciesByApiGroup(policies) {
  const groupMap = /* @__PURE__ */ new Map();
  for (const policy of policies) {
    const apiGroup = policy.spec.resource.apiGroup || "(core)";
    const existing = groupMap.get(apiGroup) || [];
    existing.push(policy);
    groupMap.set(apiGroup, existing);
  }
  const sortedGroups = Array.from(groupMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([apiGroup, policies2]) => ({
    apiGroup,
    // Sort policies by kind, then by name
    policies: policies2.sort((a, b) => {
      var _a, _b;
      const kindCompare = a.spec.resource.kind.localeCompare(b.spec.resource.kind);
      if (kindCompare !== 0)
        return kindCompare;
      return (((_a = a.metadata) == null ? void 0 : _a.name) || "").localeCompare(((_b = b.metadata) == null ? void 0 : _b.name) || "");
    })
  }));
  return sortedGroups;
}
function usePolicyList({ client, groupByApiGroup = true }) {
  const [policies, setPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const groups = useMemo(() => {
    if (!groupByApiGroup) {
      return [{ apiGroup: "All Policies", policies }];
    }
    return groupPoliciesByApiGroup(policies);
  }, [policies, groupByApiGroup]);
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.listPolicies();
      setPolicies(result.items || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client]);
  const deletePolicy = useCallback(async (name) => {
    setIsDeleting(true);
    setError(null);
    try {
      await client.deletePolicy(name);
      setPolicies((prev) => prev.filter((p2) => {
        var _a;
        return ((_a = p2.metadata) == null ? void 0 : _a.name) !== name;
      }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, [client]);
  return {
    policies,
    groups,
    isLoading,
    error,
    refresh,
    deletePolicy,
    isDeleting
  };
}
const Dialog = Root$2;
const DialogPortal = Portal$2;
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => jsx(Overlay, { ref, className: cn("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className), ...props }));
DialogOverlay.displayName = Overlay.displayName;
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => jsxs(DialogPortal, { children: [jsx(DialogOverlay, {}), jsxs(Content$2, { ref, className: cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg", className), ...props, children: [children, jsxs(Close, { className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground", children: [jsx(X$1, { className: "h-4 w-4" }), jsx("span", { className: "sr-only", children: "Close" })] })] })] }));
DialogContent.displayName = Content$2.displayName;
const DialogHeader = ({ className, ...props }) => jsx("div", { className: cn("flex flex-col space-y-1.5 text-center sm:text-left", className), ...props });
DialogHeader.displayName = "DialogHeader";
const DialogFooter = ({ className, ...props }) => jsx("div", { className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className), ...props });
DialogFooter.displayName = "DialogFooter";
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => jsx(Title, { ref, className: cn("text-lg font-semibold leading-none tracking-tight", className), ...props }));
DialogTitle.displayName = Title.displayName;
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => jsx(Description, { ref, className: cn("text-sm text-muted-foreground", className), ...props }));
DialogDescription.displayName = Description.displayName;
function PolicyList({ client, onEditPolicy, onCreatePolicy, groupByApiGroup = true, className = "" }) {
  const policyList = usePolicyList({
    client,
    groupByApiGroup
  });
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    policyName: ""
  });
  const [expandedGroups, setExpandedGroups] = useState(/* @__PURE__ */ new Set());
  useEffect(() => {
    policyList.refresh();
  }, []);
  useEffect(() => {
    if (policyList.groups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(policyList.groups.map((g) => g.apiGroup)));
    }
  }, [policyList.groups]);
  const toggleGroup = useCallback((apiGroup) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(apiGroup)) {
        next.delete(apiGroup);
      } else {
        next.add(apiGroup);
      }
      return next;
    });
  }, []);
  const handleDeleteClick = (policyName) => {
    setDeleteConfirm({ isOpen: true, policyName });
  };
  const handleDeleteConfirm = async () => {
    const { policyName } = deleteConfirm;
    setDeleteConfirm({ isOpen: false, policyName: "" });
    try {
      await policyList.deletePolicy(policyName);
    } catch (err) {
      console.error("Failed to delete policy:", err);
    }
  };
  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, policyName: "" });
  };
  const countRules = (policy) => {
    var _a, _b;
    return {
      audit: ((_a = policy.spec.auditRules) == null ? void 0 : _a.length) || 0,
      event: ((_b = policy.spec.eventRules) == null ? void 0 : _b.length) || 0
    };
  };
  const getPolicyStatus = (policy) => {
    var _a;
    const conditions = (_a = policy.status) == null ? void 0 : _a.conditions;
    if (!conditions || conditions.length === 0) {
      return { status: "pending", message: "Status not yet available" };
    }
    const readyCondition = conditions.find((c) => c.type === "Ready");
    if (!readyCondition) {
      return { status: "pending", message: "Status not yet available" };
    }
    if (readyCondition.status === "True") {
      return { status: "ready", message: readyCondition.message || "All rules compiled successfully" };
    } else if (readyCondition.status === "False") {
      return { status: "error", message: readyCondition.message || readyCondition.reason || "Rule compilation failed" };
    }
    return { status: "pending", message: readyCondition.message || "Status unknown" };
  };
  return jsxs(Card, { className: `rounded-xl ${className}`, children: [jsxs(CardHeader, { className: "pb-4", children: [jsxs("div", { className: "flex justify-between items-center", children: [jsx(CardTitle, { children: "Activity Policies" }), jsxs("div", { className: "flex gap-3", children: [jsx(Button, { variant: "outline", size: "icon", onClick: policyList.refresh, disabled: policyList.isLoading, title: "Refresh policy list", children: policyList.isLoading ? jsx("span", { className: "w-3.5 h-3.5 border-2 border-border border-t-primary rounded-full animate-spin" }) : "↻" }), onCreatePolicy && jsx(Button, { onClick: onCreatePolicy, className: "bg-[#BF9595] text-[#0C1D31] hover:bg-[#A88080]", children: "+ Create Policy" })] })] }), jsx(Separator$1, { className: "mt-4" })] }), jsxs(CardContent, { children: [policyList.error && jsxs("div", { className: "p-4 bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800 rounded-lg mb-4 flex justify-between items-center", children: [jsx("strong", { children: "Error:" }), " ", policyList.error.message, jsx(Button, { variant: "outline", size: "sm", onClick: policyList.refresh, children: "Retry" })] }), policyList.isLoading && policyList.policies.length === 0 && jsxs("div", { className: "flex items-center justify-center gap-3 py-12 text-muted-foreground", children: [jsx("span", { className: "w-5 h-5 border-[3px] border-border border-t-[#BF9595] rounded-full animate-spin" }), "Loading policies..."] }), !policyList.isLoading && !policyList.error && policyList.policies.length === 0 && jsxs("div", { className: "text-center py-12 px-8 text-muted-foreground", children: [jsx("div", { className: "text-5xl mb-4", children: "📋" }), jsx("h3", { className: "m-0 mb-2 text-foreground", children: "No policies found" }), jsx("p", { className: "m-0 mb-6 max-w-[400px] mx-auto", children: "Activity policies define how audit events and Kubernetes events are translated into human-readable activity summaries." }), onCreatePolicy && jsx(Button, { onClick: onCreatePolicy, className: "bg-[#BF9595] text-[#0C1D31] hover:bg-[#A88080]", children: "Create your first policy" })] }), policyList.groups.length > 0 && jsx("div", { className: "flex flex-col gap-4", children: policyList.groups.map((group) => jsxs("div", { className: "border border-input rounded-lg overflow-hidden", children: [jsxs("button", { type: "button", className: "w-full flex items-center gap-3 px-4 py-3 bg-muted border-none cursor-pointer text-left text-[0.9375rem] font-medium text-foreground transition-colors duration-200 hover:bg-accent", onClick: () => toggleGroup(group.apiGroup), children: [jsx("span", { className: `text-xs text-muted-foreground transition-transform duration-200 ${expandedGroups.has(group.apiGroup) ? "rotate-90" : ""}`, children: "▶" }), jsx("span", { className: "flex-1 font-mono", children: group.apiGroup }), jsx(Badge, { variant: "secondary", className: "rounded-full", children: group.policies.length })] }), expandedGroups.has(group.apiGroup) && jsx("div", { className: "p-2", children: jsxs("table", { className: "w-full border-collapse text-sm", children: [jsx("thead", { children: jsxs("tr", { children: [jsx("th", { className: "text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input", children: "Name" }), jsx("th", { className: "text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input", children: "Status" }), jsx("th", { className: "text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input", children: "Kind" }), jsx("th", { className: "text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input", children: "Audit Rules" }), jsx("th", { className: "text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input", children: "Event Rules" }), jsx("th", { className: "text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input", children: "Actions" })] }) }), jsx("tbody", { children: group.policies.map((policy) => {
    var _a, _b;
    const rules = countRules(policy);
    const policyStatus = getPolicyStatus(policy);
    return jsxs("tr", { className: "hover:bg-muted", children: [jsx("td", { className: "px-4 py-3 border-b border-border last:border-b-0 font-medium text-foreground", children: ((_a = policy.metadata) == null ? void 0 : _a.name) || "unnamed" }), jsx("td", { className: "px-4 py-3 border-b border-border last:border-b-0", children: jsx(Badge, { variant: policyStatus.status === "ready" ? "success" : policyStatus.status === "error" ? "destructive" : "secondary", className: policyStatus.status === "pending" ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" : "", title: policyStatus.message, children: policyStatus.status === "ready" ? "Ready" : policyStatus.status === "error" ? "Error" : "Pending" }) }), jsx("td", { className: "px-4 py-3 border-b border-border last:border-b-0", children: jsxs("div", { className: "flex items-center gap-2", children: [jsx(Badge, { className: "bg-[#E6F59F] text-[#0C1D31] hover:bg-[#E6F59F]", children: policy.spec.resource.kind }), policy.spec.resource.kindLabel && jsxs("span", { className: "text-muted-foreground text-xs", children: ["(", policy.spec.resource.kindLabel, ")"] })] }) }), jsx("td", { className: "px-4 py-3 border-b border-border last:border-b-0 text-center", children: jsx(Badge, { variant: rules.audit > 0 ? "success" : "secondary", className: rules.audit === 0 ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" : "", children: rules.audit }) }), jsx("td", { className: "px-4 py-3 border-b border-border last:border-b-0 text-center", children: jsx(Badge, { variant: rules.event > 0 ? "success" : "secondary", className: rules.event === 0 ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" : "", children: rules.event }) }), jsx("td", { className: "px-4 py-3 border-b border-border last:border-b-0", children: jsxs("div", { className: "flex gap-2", children: [onEditPolicy && jsx(Button, { variant: "outline", size: "sm", onClick: () => {
      var _a2;
      return onEditPolicy(((_a2 = policy.metadata) == null ? void 0 : _a2.name) || "");
    }, title: "Edit policy", children: "Edit" }), jsx(Button, { variant: "outline", size: "sm", onClick: () => {
      var _a2;
      return handleDeleteClick(((_a2 = policy.metadata) == null ? void 0 : _a2.name) || "");
    }, disabled: policyList.isDeleting, title: "Delete policy", className: "text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400 hover:text-red-600 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/50 dark:hover:border-red-600 dark:hover:text-red-400", children: "Delete" })] }) })] }, (_b = policy.metadata) == null ? void 0 : _b.name);
  }) })] }) })] }, group.apiGroup)) })] }), jsx(Dialog, { open: deleteConfirm.isOpen, onOpenChange: (open) => !open && handleDeleteCancel(), children: jsxs(DialogContent, { className: "max-w-[400px]", children: [jsxs(DialogHeader, { children: [jsx(DialogTitle, { children: "Delete Policy" }), jsxs(DialogDescription, { children: ["Are you sure you want to delete the policy", " ", jsx("strong", { children: deleteConfirm.policyName }), "?"] })] }), jsx("p", { className: "text-sm text-red-700 bg-red-50 dark:text-red-200 dark:bg-red-950/50 p-3 rounded-md", children: "This action cannot be undone. Activities already generated by this policy will remain, but no new activities will be created." }), jsxs(DialogFooter, { children: [jsx(Button, { variant: "outline", onClick: handleDeleteCancel, children: "Cancel" }), jsx(Button, { variant: "destructive", onClick: handleDeleteConfirm, children: "Delete Policy" })] })] }) })] });
}
function createEmptySpec() {
  return {
    resource: {
      apiGroup: "",
      kind: ""
    },
    auditRules: [],
    eventRules: []
  };
}
function createEmptyRule() {
  return {
    match: "",
    summary: ""
  };
}
function specsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function usePolicyEditor({ client, initialPolicyName }) {
  const [policy, setPolicy] = useState(null);
  const [name, setName] = useState(initialPolicyName || "");
  const [spec, setSpec] = useState(createEmptySpec());
  const [savedSpec, setSavedSpec] = useState(createEmptySpec());
  const [savedName, setSavedName] = useState(initialPolicyName || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const isNew = policy === null;
  const isDirty = useMemo(() => {
    if (isNew && name !== savedName)
      return true;
    return !specsEqual(spec, savedSpec);
  }, [spec, savedSpec, name, savedName, isNew]);
  const setResource = useCallback((resource) => {
    setSpec((prev) => ({ ...prev, resource }));
  }, []);
  const setAuditRules = useCallback((rules) => {
    setSpec((prev) => ({ ...prev, auditRules: rules }));
  }, []);
  const setEventRules = useCallback((rules) => {
    setSpec((prev) => ({ ...prev, eventRules: rules }));
  }, []);
  const addAuditRule = useCallback(() => {
    setSpec((prev) => ({
      ...prev,
      auditRules: [...prev.auditRules || [], createEmptyRule()]
    }));
  }, []);
  const addEventRule = useCallback(() => {
    setSpec((prev) => ({
      ...prev,
      eventRules: [...prev.eventRules || [], createEmptyRule()]
    }));
  }, []);
  const updateAuditRule = useCallback((index2, rule) => {
    setSpec((prev) => {
      const rules = [...prev.auditRules || []];
      rules[index2] = rule;
      return { ...prev, auditRules: rules };
    });
  }, []);
  const updateEventRule = useCallback((index2, rule) => {
    setSpec((prev) => {
      const rules = [...prev.eventRules || []];
      rules[index2] = rule;
      return { ...prev, eventRules: rules };
    });
  }, []);
  const removeAuditRule = useCallback((index2) => {
    setSpec((prev) => ({
      ...prev,
      auditRules: (prev.auditRules || []).filter((_, i) => i !== index2)
    }));
  }, []);
  const removeEventRule = useCallback((index2) => {
    setSpec((prev) => ({
      ...prev,
      eventRules: (prev.eventRules || []).filter((_, i) => i !== index2)
    }));
  }, []);
  const load2 = useCallback(async (policyName) => {
    var _a, _b;
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.getPolicy(policyName);
      setPolicy(result);
      setName(((_a = result.metadata) == null ? void 0 : _a.name) || policyName);
      setSpec(result.spec);
      setSavedSpec(result.spec);
      setSavedName(((_b = result.metadata) == null ? void 0 : _b.name) || policyName);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client]);
  const save = useCallback(async (dryRun) => {
    var _a, _b;
    if (!name.trim()) {
      throw new Error("Policy name is required");
    }
    setIsSaving(true);
    setError(null);
    try {
      let result;
      if (isNew) {
        result = await client.createPolicy(name, spec, dryRun);
      } else {
        result = await client.updatePolicy(name, spec, dryRun, (_a = policy == null ? void 0 : policy.metadata) == null ? void 0 : _a.resourceVersion);
      }
      if (!dryRun) {
        setPolicy(result);
        setSavedSpec(result.spec);
        setSavedName(((_b = result.metadata) == null ? void 0 : _b.name) || name);
      }
      return result;
    } catch (err) {
      const error2 = err instanceof Error ? err : new Error(String(err));
      setError(error2);
      throw error2;
    } finally {
      setIsSaving(false);
    }
  }, [client, name, spec, isNew, policy]);
  const reset = useCallback(() => {
    setSpec(savedSpec);
    setName(savedName);
    setError(null);
  }, [savedSpec, savedName]);
  const clear = useCallback(() => {
    setPolicy(null);
    setName("");
    setSpec(createEmptySpec());
    setSavedSpec(createEmptySpec());
    setSavedName("");
    setError(null);
  }, []);
  return {
    policy,
    spec,
    name,
    isDirty,
    isLoading,
    isSaving,
    error,
    isNew,
    setName,
    setSpec,
    setResource,
    setAuditRules,
    setEventRules,
    addAuditRule,
    addEventRule,
    updateAuditRule,
    updateEventRule,
    removeAuditRule,
    removeEventRule,
    save,
    load: load2,
    reset,
    clear
  };
}
function createEmptyAuditEvent() {
  return {
    level: "RequestResponse",
    auditID: "preview-" + Date.now(),
    stage: "ResponseComplete",
    requestURI: "/apis/example.com/v1/namespaces/default/examples/my-example",
    verb: "create",
    user: {
      username: "alice@example.com",
      uid: "user-123",
      groups: ["users", "developers"]
    },
    objectRef: {
      apiGroup: "example.com",
      apiVersion: "v1",
      resource: "examples",
      namespace: "default",
      name: "my-example",
      uid: "resource-456"
    },
    responseStatus: {
      code: 201,
      status: "Success"
    },
    requestReceivedTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
    stageTimestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function createEmptyKubernetesEvent() {
  return {
    type: "Normal",
    reason: "Created",
    message: "Example resource was created successfully",
    involvedObject: {
      apiVersion: "example.com/v1",
      kind: "Example",
      name: "my-example",
      namespace: "default",
      uid: "resource-456"
    },
    source: {
      component: "example-controller"
    },
    firstTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
    lastTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
    count: 1,
    metadata: {
      name: "my-example.123abc",
      namespace: "default"
    }
  };
}
function createInitialInput() {
  return {
    type: "audit",
    audit: createEmptyAuditEvent()
  };
}
function usePolicyPreview({ client }) {
  const [inputs, setInputsState] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState(/* @__PURE__ */ new Set());
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const setInputs = useCallback((newInputs) => {
    setInputsState(newInputs);
    setSelectedIndices(new Set(newInputs.map((_, i) => i)));
    setResult(null);
    setError(null);
  }, []);
  const addInput = useCallback((input2) => {
    setInputsState((prev) => {
      const newInputs = [...prev, input2];
      setSelectedIndices((prevSelected) => /* @__PURE__ */ new Set([...prevSelected, newInputs.length - 1]));
      return newInputs;
    });
  }, []);
  const removeInput = useCallback((index2) => {
    setInputsState((prev) => prev.filter((_, i) => i !== index2));
    setSelectedIndices((prev) => {
      const newSet = /* @__PURE__ */ new Set();
      prev.forEach((i) => {
        if (i < index2)
          newSet.add(i);
        else if (i > index2)
          newSet.add(i - 1);
      });
      return newSet;
    });
  }, []);
  const toggleSelection = useCallback((index2) => {
    setSelectedIndices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index2)) {
        newSet.delete(index2);
      } else {
        newSet.add(index2);
      }
      return newSet;
    });
  }, []);
  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(inputs.map((_, i) => i)));
  }, [inputs]);
  const deselectAll = useCallback(() => {
    setSelectedIndices(/* @__PURE__ */ new Set());
  }, []);
  const setAuditInputs = useCallback((events) => {
    const newInputs = events.map((event) => ({
      type: "audit",
      audit: event
    }));
    setInputs(newInputs);
  }, [setInputs]);
  const setEventInputs = useCallback((events) => {
    const newInputs = events.map((event) => ({
      type: "event",
      event
    }));
    setInputs(newInputs);
  }, [setInputs]);
  const getSelectedInputs = useCallback(() => {
    return inputs.filter((_, i) => selectedIndices.has(i));
  }, [inputs, selectedIndices]);
  const getInputJson = useCallback(() => {
    const selected = getSelectedInputs();
    if (selected.length === 0)
      return "[]";
    if (selected.length === 1) {
      const input2 = selected[0];
      const data = input2.type === "audit" ? input2.audit : input2.event;
      return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(selected, null, 2);
  }, [getSelectedInputs]);
  const runPreview = useCallback(async (policySpec, kindLabel, kindLabelPlural) => {
    const selectedInputs = getSelectedInputs();
    if (selectedInputs.length === 0) {
      const err = new Error("No inputs selected for preview");
      setError(err);
      throw err;
    }
    setIsLoading(true);
    setError(null);
    try {
      const spec = {
        policy: policySpec,
        inputs: selectedInputs,
        kindLabel,
        kindLabelPlural
      };
      const previewResult = await client.createPolicyPreview(spec);
      const status = previewResult.status || {
        activities: [],
        results: [],
        error: "No status returned from server"
      };
      setResult(status);
      return status;
    } catch (err) {
      const error2 = err instanceof Error ? err : new Error(String(err));
      setError(error2);
      setResult({
        activities: [],
        results: [],
        error: error2.message
      });
      throw error2;
    } finally {
      setIsLoading(false);
    }
  }, [client, getSelectedInputs]);
  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);
  const reset = useCallback(() => {
    setInputsState([]);
    setSelectedIndices(/* @__PURE__ */ new Set());
    setResult(null);
    setError(null);
  }, []);
  const input = inputs[0] || createInitialInput();
  const setInput = useCallback((newInput) => {
    setInputs([newInput]);
  }, [setInputs]);
  const setAuditInput = useCallback((audit) => {
    setInputs([{ type: "audit", audit }]);
  }, [setInputs]);
  const setEventInput = useCallback((event) => {
    setInputs([{ type: "event", event }]);
  }, [setInputs]);
  const setInputFromJson = useCallback((json) => {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        setInputs(parsed);
      } else {
        const inputType = parsed.verb ? "audit" : "event";
        if (inputType === "audit") {
          setInputs([{ type: "audit", audit: parsed }]);
        } else {
          setInputs([{ type: "event", event: parsed }]);
        }
      }
    } catch (err) {
      setError(new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`));
    }
  }, [setInputs]);
  const setInputType = useCallback((type) => {
    if (type === "audit") {
      setInputs([{ type: "audit", audit: createEmptyAuditEvent() }]);
    } else {
      setInputs([{ type: "event", event: createEmptyKubernetesEvent() }]);
    }
  }, [setInputs]);
  return {
    inputs,
    selectedIndices,
    result,
    isLoading,
    error,
    setInputs,
    addInput,
    removeInput,
    toggleSelection,
    selectAll,
    deselectAll,
    setAuditInputs,
    setEventInputs,
    runPreview,
    clearResult,
    reset,
    getSelectedInputs,
    hasSelection: selectedIndices.size > 0,
    // Legacy support
    input,
    setInput,
    setAuditInput,
    setEventInput,
    setInputFromJson,
    setInputType,
    getInputJson
  };
}
function clamp(value, [min2, max2]) {
  return Math.min(max2, Math.max(min2, value));
}
function createCollection(name) {
  const PROVIDER_NAME = name + "CollectionProvider";
  const [createCollectionContext, createCollectionScope2] = createContextScope(PROVIDER_NAME);
  const [CollectionProviderImpl, useCollectionContext] = createCollectionContext(
    PROVIDER_NAME,
    { collectionRef: { current: null }, itemMap: /* @__PURE__ */ new Map() }
  );
  const CollectionProvider = (props) => {
    const { scope, children } = props;
    const ref = React__default.useRef(null);
    const itemMap = React__default.useRef(/* @__PURE__ */ new Map()).current;
    return /* @__PURE__ */ jsx(CollectionProviderImpl, { scope, itemMap, collectionRef: ref, children });
  };
  CollectionProvider.displayName = PROVIDER_NAME;
  const COLLECTION_SLOT_NAME = name + "CollectionSlot";
  const CollectionSlotImpl = /* @__PURE__ */ createSlot(COLLECTION_SLOT_NAME);
  const CollectionSlot = React__default.forwardRef(
    (props, forwardedRef) => {
      const { scope, children } = props;
      const context = useCollectionContext(COLLECTION_SLOT_NAME, scope);
      const composedRefs = useComposedRefs(forwardedRef, context.collectionRef);
      return /* @__PURE__ */ jsx(CollectionSlotImpl, { ref: composedRefs, children });
    }
  );
  CollectionSlot.displayName = COLLECTION_SLOT_NAME;
  const ITEM_SLOT_NAME = name + "CollectionItemSlot";
  const ITEM_DATA_ATTR = "data-radix-collection-item";
  const CollectionItemSlotImpl = /* @__PURE__ */ createSlot(ITEM_SLOT_NAME);
  const CollectionItemSlot = React__default.forwardRef(
    (props, forwardedRef) => {
      const { scope, children, ...itemData } = props;
      const ref = React__default.useRef(null);
      const composedRefs = useComposedRefs(forwardedRef, ref);
      const context = useCollectionContext(ITEM_SLOT_NAME, scope);
      React__default.useEffect(() => {
        context.itemMap.set(ref, { ref, ...itemData });
        return () => void context.itemMap.delete(ref);
      });
      return /* @__PURE__ */ jsx(CollectionItemSlotImpl, { ...{ [ITEM_DATA_ATTR]: "" }, ref: composedRefs, children });
    }
  );
  CollectionItemSlot.displayName = ITEM_SLOT_NAME;
  function useCollection2(scope) {
    const context = useCollectionContext(name + "CollectionConsumer", scope);
    const getItems = React__default.useCallback(() => {
      const collectionNode = context.collectionRef.current;
      if (!collectionNode) return [];
      const orderedNodes = Array.from(collectionNode.querySelectorAll(`[${ITEM_DATA_ATTR}]`));
      const items = Array.from(context.itemMap.values());
      const orderedItems = items.sort(
        (a, b) => orderedNodes.indexOf(a.ref.current) - orderedNodes.indexOf(b.ref.current)
      );
      return orderedItems;
    }, [context.collectionRef, context.itemMap]);
    return getItems;
  }
  return [
    { Provider: CollectionProvider, Slot: CollectionSlot, ItemSlot: CollectionItemSlot },
    useCollection2,
    createCollectionScope2
  ];
}
var DirectionContext = React.createContext(void 0);
function useDirection(localDir) {
  const globalDir = React.useContext(DirectionContext);
  return localDir || globalDir || "ltr";
}
var VISUALLY_HIDDEN_STYLES = Object.freeze({
  // See: https://github.com/twbs/bootstrap/blob/main/scss/mixins/_visually-hidden.scss
  position: "absolute",
  border: 0,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  wordWrap: "normal"
});
var NAME = "VisuallyHidden";
var VisuallyHidden = React.forwardRef(
  (props, forwardedRef) => {
    return /* @__PURE__ */ jsx(
      Primitive.span,
      {
        ...props,
        ref: forwardedRef,
        style: { ...VISUALLY_HIDDEN_STYLES, ...props.style }
      }
    );
  }
);
VisuallyHidden.displayName = NAME;
var OPEN_KEYS = [" ", "Enter", "ArrowUp", "ArrowDown"];
var SELECTION_KEYS = [" ", "Enter"];
var SELECT_NAME = "Select";
var [Collection$1, useCollection$1, createCollectionScope$1] = createCollection(SELECT_NAME);
var [createSelectContext] = createContextScope(SELECT_NAME, [
  createCollectionScope$1,
  createPopperScope
]);
var usePopperScope = createPopperScope();
var [SelectProvider, useSelectContext] = createSelectContext(SELECT_NAME);
var [SelectNativeOptionsProvider, useSelectNativeOptionsContext] = createSelectContext(SELECT_NAME);
var Select$1 = (props) => {
  const {
    __scopeSelect,
    children,
    open: openProp,
    defaultOpen,
    onOpenChange,
    value: valueProp,
    defaultValue,
    onValueChange,
    dir,
    name,
    autoComplete,
    disabled,
    required,
    form
  } = props;
  const popperScope = usePopperScope(__scopeSelect);
  const [trigger, setTrigger] = React.useState(null);
  const [valueNode, setValueNode] = React.useState(null);
  const [valueNodeHasChildren, setValueNodeHasChildren] = React.useState(false);
  const direction = useDirection(dir);
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
    caller: SELECT_NAME
  });
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
    caller: SELECT_NAME
  });
  const triggerPointerDownPosRef = React.useRef(null);
  const isFormControl = trigger ? form || !!trigger.closest("form") : true;
  const [nativeOptionsSet, setNativeOptionsSet] = React.useState(/* @__PURE__ */ new Set());
  const nativeSelectKey = Array.from(nativeOptionsSet).map((option) => option.props.value).join(";");
  return /* @__PURE__ */ jsx(Root2$3, { ...popperScope, children: /* @__PURE__ */ jsxs(
    SelectProvider,
    {
      required,
      scope: __scopeSelect,
      trigger,
      onTriggerChange: setTrigger,
      valueNode,
      onValueNodeChange: setValueNode,
      valueNodeHasChildren,
      onValueNodeHasChildrenChange: setValueNodeHasChildren,
      contentId: useId(),
      value,
      onValueChange: setValue,
      open,
      onOpenChange: setOpen,
      dir: direction,
      triggerPointerDownPosRef,
      disabled,
      children: [
        /* @__PURE__ */ jsx(Collection$1.Provider, { scope: __scopeSelect, children: /* @__PURE__ */ jsx(
          SelectNativeOptionsProvider,
          {
            scope: props.__scopeSelect,
            onNativeOptionAdd: React.useCallback((option) => {
              setNativeOptionsSet((prev) => new Set(prev).add(option));
            }, []),
            onNativeOptionRemove: React.useCallback((option) => {
              setNativeOptionsSet((prev) => {
                const optionsSet = new Set(prev);
                optionsSet.delete(option);
                return optionsSet;
              });
            }, []),
            children
          }
        ) }),
        isFormControl ? /* @__PURE__ */ jsxs(
          SelectBubbleInput,
          {
            "aria-hidden": true,
            required,
            tabIndex: -1,
            name,
            autoComplete,
            value,
            onChange: (event) => setValue(event.target.value),
            disabled,
            form,
            children: [
              value === void 0 ? /* @__PURE__ */ jsx("option", { value: "" }) : null,
              Array.from(nativeOptionsSet)
            ]
          },
          nativeSelectKey
        ) : null
      ]
    }
  ) });
};
Select$1.displayName = SELECT_NAME;
var TRIGGER_NAME$1 = "SelectTrigger";
var SelectTrigger$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSelect, disabled = false, ...triggerProps } = props;
    const popperScope = usePopperScope(__scopeSelect);
    const context = useSelectContext(TRIGGER_NAME$1, __scopeSelect);
    const isDisabled = context.disabled || disabled;
    const composedRefs = useComposedRefs(forwardedRef, context.onTriggerChange);
    const getItems = useCollection$1(__scopeSelect);
    const pointerTypeRef = React.useRef("touch");
    const [searchRef, handleTypeaheadSearch, resetTypeahead] = useTypeaheadSearch((search) => {
      const enabledItems = getItems().filter((item) => !item.disabled);
      const currentItem = enabledItems.find((item) => item.value === context.value);
      const nextItem = findNextItem(enabledItems, search, currentItem);
      if (nextItem !== void 0) {
        context.onValueChange(nextItem.value);
      }
    });
    const handleOpen = (pointerEvent) => {
      if (!isDisabled) {
        context.onOpenChange(true);
        resetTypeahead();
      }
      if (pointerEvent) {
        context.triggerPointerDownPosRef.current = {
          x: Math.round(pointerEvent.pageX),
          y: Math.round(pointerEvent.pageY)
        };
      }
    };
    return /* @__PURE__ */ jsx(Anchor, { asChild: true, ...popperScope, children: /* @__PURE__ */ jsx(
      Primitive.button,
      {
        type: "button",
        role: "combobox",
        "aria-controls": context.contentId,
        "aria-expanded": context.open,
        "aria-required": context.required,
        "aria-autocomplete": "none",
        dir: context.dir,
        "data-state": context.open ? "open" : "closed",
        disabled: isDisabled,
        "data-disabled": isDisabled ? "" : void 0,
        "data-placeholder": shouldShowPlaceholder(context.value) ? "" : void 0,
        ...triggerProps,
        ref: composedRefs,
        onClick: composeEventHandlers(triggerProps.onClick, (event) => {
          event.currentTarget.focus();
          if (pointerTypeRef.current !== "mouse") {
            handleOpen(event);
          }
        }),
        onPointerDown: composeEventHandlers(triggerProps.onPointerDown, (event) => {
          pointerTypeRef.current = event.pointerType;
          const target = event.target;
          if (target.hasPointerCapture(event.pointerId)) {
            target.releasePointerCapture(event.pointerId);
          }
          if (event.button === 0 && event.ctrlKey === false && event.pointerType === "mouse") {
            handleOpen(event);
            event.preventDefault();
          }
        }),
        onKeyDown: composeEventHandlers(triggerProps.onKeyDown, (event) => {
          const isTypingAhead = searchRef.current !== "";
          const isModifierKey = event.ctrlKey || event.altKey || event.metaKey;
          if (!isModifierKey && event.key.length === 1) handleTypeaheadSearch(event.key);
          if (isTypingAhead && event.key === " ") return;
          if (OPEN_KEYS.includes(event.key)) {
            handleOpen();
            event.preventDefault();
          }
        })
      }
    ) });
  }
);
SelectTrigger$1.displayName = TRIGGER_NAME$1;
var VALUE_NAME = "SelectValue";
var SelectValue$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSelect, className, style, children, placeholder = "", ...valueProps } = props;
    const context = useSelectContext(VALUE_NAME, __scopeSelect);
    const { onValueNodeHasChildrenChange } = context;
    const hasChildren = children !== void 0;
    const composedRefs = useComposedRefs(forwardedRef, context.onValueNodeChange);
    useLayoutEffect2(() => {
      onValueNodeHasChildrenChange(hasChildren);
    }, [onValueNodeHasChildrenChange, hasChildren]);
    return /* @__PURE__ */ jsx(
      Primitive.span,
      {
        ...valueProps,
        ref: composedRefs,
        style: { pointerEvents: "none" },
        children: shouldShowPlaceholder(context.value) ? /* @__PURE__ */ jsx(Fragment, { children: placeholder }) : children
      }
    );
  }
);
SelectValue$1.displayName = VALUE_NAME;
var ICON_NAME = "SelectIcon";
var SelectIcon = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSelect, children, ...iconProps } = props;
    return /* @__PURE__ */ jsx(Primitive.span, { "aria-hidden": true, ...iconProps, ref: forwardedRef, children: children || "▼" });
  }
);
SelectIcon.displayName = ICON_NAME;
var PORTAL_NAME = "SelectPortal";
var SelectPortal = (props) => {
  return /* @__PURE__ */ jsx(Portal$3, { asChild: true, ...props });
};
SelectPortal.displayName = PORTAL_NAME;
var CONTENT_NAME$1 = "SelectContent";
var SelectContent$1 = React.forwardRef(
  (props, forwardedRef) => {
    const context = useSelectContext(CONTENT_NAME$1, props.__scopeSelect);
    const [fragment, setFragment] = React.useState();
    useLayoutEffect2(() => {
      setFragment(new DocumentFragment());
    }, []);
    if (!context.open) {
      const frag = fragment;
      return frag ? ReactDOM.createPortal(
        /* @__PURE__ */ jsx(SelectContentProvider, { scope: props.__scopeSelect, children: /* @__PURE__ */ jsx(Collection$1.Slot, { scope: props.__scopeSelect, children: /* @__PURE__ */ jsx("div", { children: props.children }) }) }),
        frag
      ) : null;
    }
    return /* @__PURE__ */ jsx(SelectContentImpl, { ...props, ref: forwardedRef });
  }
);
SelectContent$1.displayName = CONTENT_NAME$1;
var CONTENT_MARGIN = 10;
var [SelectContentProvider, useSelectContentContext] = createSelectContext(CONTENT_NAME$1);
var CONTENT_IMPL_NAME = "SelectContentImpl";
var Slot = /* @__PURE__ */ createSlot("SelectContent.RemoveScroll");
var SelectContentImpl = React.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeSelect,
      position = "item-aligned",
      onCloseAutoFocus,
      onEscapeKeyDown,
      onPointerDownOutside,
      //
      // PopperContent props
      side,
      sideOffset,
      align,
      alignOffset,
      arrowPadding,
      collisionBoundary,
      collisionPadding,
      sticky,
      hideWhenDetached,
      avoidCollisions,
      //
      ...contentProps
    } = props;
    const context = useSelectContext(CONTENT_NAME$1, __scopeSelect);
    const [content, setContent] = React.useState(null);
    const [viewport, setViewport] = React.useState(null);
    const composedRefs = useComposedRefs(forwardedRef, (node) => setContent(node));
    const [selectedItem, setSelectedItem] = React.useState(null);
    const [selectedItemText, setSelectedItemText] = React.useState(
      null
    );
    const getItems = useCollection$1(__scopeSelect);
    const [isPositioned, setIsPositioned] = React.useState(false);
    const firstValidItemFoundRef = React.useRef(false);
    React.useEffect(() => {
      if (content) return hideOthers(content);
    }, [content]);
    useFocusGuards();
    const focusFirst2 = React.useCallback(
      (candidates) => {
        const [firstItem, ...restItems] = getItems().map((item) => item.ref.current);
        const [lastItem] = restItems.slice(-1);
        const PREVIOUSLY_FOCUSED_ELEMENT = document.activeElement;
        for (const candidate of candidates) {
          if (candidate === PREVIOUSLY_FOCUSED_ELEMENT) return;
          candidate == null ? void 0 : candidate.scrollIntoView({ block: "nearest" });
          if (candidate === firstItem && viewport) viewport.scrollTop = 0;
          if (candidate === lastItem && viewport) viewport.scrollTop = viewport.scrollHeight;
          candidate == null ? void 0 : candidate.focus();
          if (document.activeElement !== PREVIOUSLY_FOCUSED_ELEMENT) return;
        }
      },
      [getItems, viewport]
    );
    const focusSelectedItem = React.useCallback(
      () => focusFirst2([selectedItem, content]),
      [focusFirst2, selectedItem, content]
    );
    React.useEffect(() => {
      if (isPositioned) {
        focusSelectedItem();
      }
    }, [isPositioned, focusSelectedItem]);
    const { onOpenChange, triggerPointerDownPosRef } = context;
    React.useEffect(() => {
      if (content) {
        let pointerMoveDelta = { x: 0, y: 0 };
        const handlePointerMove = (event) => {
          var _a, _b;
          pointerMoveDelta = {
            x: Math.abs(Math.round(event.pageX) - (((_a = triggerPointerDownPosRef.current) == null ? void 0 : _a.x) ?? 0)),
            y: Math.abs(Math.round(event.pageY) - (((_b = triggerPointerDownPosRef.current) == null ? void 0 : _b.y) ?? 0))
          };
        };
        const handlePointerUp = (event) => {
          if (pointerMoveDelta.x <= 10 && pointerMoveDelta.y <= 10) {
            event.preventDefault();
          } else {
            if (!content.contains(event.target)) {
              onOpenChange(false);
            }
          }
          document.removeEventListener("pointermove", handlePointerMove);
          triggerPointerDownPosRef.current = null;
        };
        if (triggerPointerDownPosRef.current !== null) {
          document.addEventListener("pointermove", handlePointerMove);
          document.addEventListener("pointerup", handlePointerUp, { capture: true, once: true });
        }
        return () => {
          document.removeEventListener("pointermove", handlePointerMove);
          document.removeEventListener("pointerup", handlePointerUp, { capture: true });
        };
      }
    }, [content, onOpenChange, triggerPointerDownPosRef]);
    React.useEffect(() => {
      const close = () => onOpenChange(false);
      window.addEventListener("blur", close);
      window.addEventListener("resize", close);
      return () => {
        window.removeEventListener("blur", close);
        window.removeEventListener("resize", close);
      };
    }, [onOpenChange]);
    const [searchRef, handleTypeaheadSearch] = useTypeaheadSearch((search) => {
      const enabledItems = getItems().filter((item) => !item.disabled);
      const currentItem = enabledItems.find((item) => item.ref.current === document.activeElement);
      const nextItem = findNextItem(enabledItems, search, currentItem);
      if (nextItem) {
        setTimeout(() => nextItem.ref.current.focus());
      }
    });
    const itemRefCallback = React.useCallback(
      (node, value, disabled) => {
        const isFirstValidItem = !firstValidItemFoundRef.current && !disabled;
        const isSelectedItem = context.value !== void 0 && context.value === value;
        if (isSelectedItem || isFirstValidItem) {
          setSelectedItem(node);
          if (isFirstValidItem) firstValidItemFoundRef.current = true;
        }
      },
      [context.value]
    );
    const handleItemLeave = React.useCallback(() => content == null ? void 0 : content.focus(), [content]);
    const itemTextRefCallback = React.useCallback(
      (node, value, disabled) => {
        const isFirstValidItem = !firstValidItemFoundRef.current && !disabled;
        const isSelectedItem = context.value !== void 0 && context.value === value;
        if (isSelectedItem || isFirstValidItem) {
          setSelectedItemText(node);
        }
      },
      [context.value]
    );
    const SelectPosition = position === "popper" ? SelectPopperPosition : SelectItemAlignedPosition;
    const popperContentProps = SelectPosition === SelectPopperPosition ? {
      side,
      sideOffset,
      align,
      alignOffset,
      arrowPadding,
      collisionBoundary,
      collisionPadding,
      sticky,
      hideWhenDetached,
      avoidCollisions
    } : {};
    return /* @__PURE__ */ jsx(
      SelectContentProvider,
      {
        scope: __scopeSelect,
        content,
        viewport,
        onViewportChange: setViewport,
        itemRefCallback,
        selectedItem,
        onItemLeave: handleItemLeave,
        itemTextRefCallback,
        focusSelectedItem,
        selectedItemText,
        position,
        isPositioned,
        searchRef,
        children: /* @__PURE__ */ jsx(ReactRemoveScroll, { as: Slot, allowPinchZoom: true, children: /* @__PURE__ */ jsx(
          FocusScope,
          {
            asChild: true,
            trapped: context.open,
            onMountAutoFocus: (event) => {
              event.preventDefault();
            },
            onUnmountAutoFocus: composeEventHandlers(onCloseAutoFocus, (event) => {
              var _a;
              (_a = context.trigger) == null ? void 0 : _a.focus({ preventScroll: true });
              event.preventDefault();
            }),
            children: /* @__PURE__ */ jsx(
              DismissableLayer,
              {
                asChild: true,
                disableOutsidePointerEvents: true,
                onEscapeKeyDown,
                onPointerDownOutside,
                onFocusOutside: (event) => event.preventDefault(),
                onDismiss: () => context.onOpenChange(false),
                children: /* @__PURE__ */ jsx(
                  SelectPosition,
                  {
                    role: "listbox",
                    id: context.contentId,
                    "data-state": context.open ? "open" : "closed",
                    dir: context.dir,
                    onContextMenu: (event) => event.preventDefault(),
                    ...contentProps,
                    ...popperContentProps,
                    onPlaced: () => setIsPositioned(true),
                    ref: composedRefs,
                    style: {
                      // flex layout so we can place the scroll buttons properly
                      display: "flex",
                      flexDirection: "column",
                      // reset the outline by default as the content MAY get focused
                      outline: "none",
                      ...contentProps.style
                    },
                    onKeyDown: composeEventHandlers(contentProps.onKeyDown, (event) => {
                      const isModifierKey = event.ctrlKey || event.altKey || event.metaKey;
                      if (event.key === "Tab") event.preventDefault();
                      if (!isModifierKey && event.key.length === 1) handleTypeaheadSearch(event.key);
                      if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                        const items = getItems().filter((item) => !item.disabled);
                        let candidateNodes = items.map((item) => item.ref.current);
                        if (["ArrowUp", "End"].includes(event.key)) {
                          candidateNodes = candidateNodes.slice().reverse();
                        }
                        if (["ArrowUp", "ArrowDown"].includes(event.key)) {
                          const currentElement = event.target;
                          const currentIndex = candidateNodes.indexOf(currentElement);
                          candidateNodes = candidateNodes.slice(currentIndex + 1);
                        }
                        setTimeout(() => focusFirst2(candidateNodes));
                        event.preventDefault();
                      }
                    })
                  }
                )
              }
            )
          }
        ) })
      }
    );
  }
);
SelectContentImpl.displayName = CONTENT_IMPL_NAME;
var ITEM_ALIGNED_POSITION_NAME = "SelectItemAlignedPosition";
var SelectItemAlignedPosition = React.forwardRef((props, forwardedRef) => {
  const { __scopeSelect, onPlaced, ...popperProps } = props;
  const context = useSelectContext(CONTENT_NAME$1, __scopeSelect);
  const contentContext = useSelectContentContext(CONTENT_NAME$1, __scopeSelect);
  const [contentWrapper, setContentWrapper] = React.useState(null);
  const [content, setContent] = React.useState(null);
  const composedRefs = useComposedRefs(forwardedRef, (node) => setContent(node));
  const getItems = useCollection$1(__scopeSelect);
  const shouldExpandOnScrollRef = React.useRef(false);
  const shouldRepositionRef = React.useRef(true);
  const { viewport, selectedItem, selectedItemText, focusSelectedItem } = contentContext;
  const position = React.useCallback(() => {
    if (context.trigger && context.valueNode && contentWrapper && content && viewport && selectedItem && selectedItemText) {
      const triggerRect = context.trigger.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const valueNodeRect = context.valueNode.getBoundingClientRect();
      const itemTextRect = selectedItemText.getBoundingClientRect();
      if (context.dir !== "rtl") {
        const itemTextOffset = itemTextRect.left - contentRect.left;
        const left = valueNodeRect.left - itemTextOffset;
        const leftDelta = triggerRect.left - left;
        const minContentWidth = triggerRect.width + leftDelta;
        const contentWidth = Math.max(minContentWidth, contentRect.width);
        const rightEdge = window.innerWidth - CONTENT_MARGIN;
        const clampedLeft = clamp(left, [
          CONTENT_MARGIN,
          // Prevents the content from going off the starting edge of the
          // viewport. It may still go off the ending edge, but this can be
          // controlled by the user since they may want to manage overflow in a
          // specific way.
          // https://github.com/radix-ui/primitives/issues/2049
          Math.max(CONTENT_MARGIN, rightEdge - contentWidth)
        ]);
        contentWrapper.style.minWidth = minContentWidth + "px";
        contentWrapper.style.left = clampedLeft + "px";
      } else {
        const itemTextOffset = contentRect.right - itemTextRect.right;
        const right = window.innerWidth - valueNodeRect.right - itemTextOffset;
        const rightDelta = window.innerWidth - triggerRect.right - right;
        const minContentWidth = triggerRect.width + rightDelta;
        const contentWidth = Math.max(minContentWidth, contentRect.width);
        const leftEdge = window.innerWidth - CONTENT_MARGIN;
        const clampedRight = clamp(right, [
          CONTENT_MARGIN,
          Math.max(CONTENT_MARGIN, leftEdge - contentWidth)
        ]);
        contentWrapper.style.minWidth = minContentWidth + "px";
        contentWrapper.style.right = clampedRight + "px";
      }
      const items = getItems();
      const availableHeight = window.innerHeight - CONTENT_MARGIN * 2;
      const itemsHeight = viewport.scrollHeight;
      const contentStyles = window.getComputedStyle(content);
      const contentBorderTopWidth = parseInt(contentStyles.borderTopWidth, 10);
      const contentPaddingTop = parseInt(contentStyles.paddingTop, 10);
      const contentBorderBottomWidth = parseInt(contentStyles.borderBottomWidth, 10);
      const contentPaddingBottom = parseInt(contentStyles.paddingBottom, 10);
      const fullContentHeight = contentBorderTopWidth + contentPaddingTop + itemsHeight + contentPaddingBottom + contentBorderBottomWidth;
      const minContentHeight = Math.min(selectedItem.offsetHeight * 5, fullContentHeight);
      const viewportStyles = window.getComputedStyle(viewport);
      const viewportPaddingTop = parseInt(viewportStyles.paddingTop, 10);
      const viewportPaddingBottom = parseInt(viewportStyles.paddingBottom, 10);
      const topEdgeToTriggerMiddle = triggerRect.top + triggerRect.height / 2 - CONTENT_MARGIN;
      const triggerMiddleToBottomEdge = availableHeight - topEdgeToTriggerMiddle;
      const selectedItemHalfHeight = selectedItem.offsetHeight / 2;
      const itemOffsetMiddle = selectedItem.offsetTop + selectedItemHalfHeight;
      const contentTopToItemMiddle = contentBorderTopWidth + contentPaddingTop + itemOffsetMiddle;
      const itemMiddleToContentBottom = fullContentHeight - contentTopToItemMiddle;
      const willAlignWithoutTopOverflow = contentTopToItemMiddle <= topEdgeToTriggerMiddle;
      if (willAlignWithoutTopOverflow) {
        const isLastItem = items.length > 0 && selectedItem === items[items.length - 1].ref.current;
        contentWrapper.style.bottom = "0px";
        const viewportOffsetBottom = content.clientHeight - viewport.offsetTop - viewport.offsetHeight;
        const clampedTriggerMiddleToBottomEdge = Math.max(
          triggerMiddleToBottomEdge,
          selectedItemHalfHeight + // viewport might have padding bottom, include it to avoid a scrollable viewport
          (isLastItem ? viewportPaddingBottom : 0) + viewportOffsetBottom + contentBorderBottomWidth
        );
        const height = contentTopToItemMiddle + clampedTriggerMiddleToBottomEdge;
        contentWrapper.style.height = height + "px";
      } else {
        const isFirstItem = items.length > 0 && selectedItem === items[0].ref.current;
        contentWrapper.style.top = "0px";
        const clampedTopEdgeToTriggerMiddle = Math.max(
          topEdgeToTriggerMiddle,
          contentBorderTopWidth + viewport.offsetTop + // viewport might have padding top, include it to avoid a scrollable viewport
          (isFirstItem ? viewportPaddingTop : 0) + selectedItemHalfHeight
        );
        const height = clampedTopEdgeToTriggerMiddle + itemMiddleToContentBottom;
        contentWrapper.style.height = height + "px";
        viewport.scrollTop = contentTopToItemMiddle - topEdgeToTriggerMiddle + viewport.offsetTop;
      }
      contentWrapper.style.margin = `${CONTENT_MARGIN}px 0`;
      contentWrapper.style.minHeight = minContentHeight + "px";
      contentWrapper.style.maxHeight = availableHeight + "px";
      onPlaced == null ? void 0 : onPlaced();
      requestAnimationFrame(() => shouldExpandOnScrollRef.current = true);
    }
  }, [
    getItems,
    context.trigger,
    context.valueNode,
    contentWrapper,
    content,
    viewport,
    selectedItem,
    selectedItemText,
    context.dir,
    onPlaced
  ]);
  useLayoutEffect2(() => position(), [position]);
  const [contentZIndex, setContentZIndex] = React.useState();
  useLayoutEffect2(() => {
    if (content) setContentZIndex(window.getComputedStyle(content).zIndex);
  }, [content]);
  const handleScrollButtonChange = React.useCallback(
    (node) => {
      if (node && shouldRepositionRef.current === true) {
        position();
        focusSelectedItem == null ? void 0 : focusSelectedItem();
        shouldRepositionRef.current = false;
      }
    },
    [position, focusSelectedItem]
  );
  return /* @__PURE__ */ jsx(
    SelectViewportProvider,
    {
      scope: __scopeSelect,
      contentWrapper,
      shouldExpandOnScrollRef,
      onScrollButtonChange: handleScrollButtonChange,
      children: /* @__PURE__ */ jsx(
        "div",
        {
          ref: setContentWrapper,
          style: {
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            zIndex: contentZIndex
          },
          children: /* @__PURE__ */ jsx(
            Primitive.div,
            {
              ...popperProps,
              ref: composedRefs,
              style: {
                // When we get the height of the content, it includes borders. If we were to set
                // the height without having `boxSizing: 'border-box'` it would be too big.
                boxSizing: "border-box",
                // We need to ensure the content doesn't get taller than the wrapper
                maxHeight: "100%",
                ...popperProps.style
              }
            }
          )
        }
      )
    }
  );
});
SelectItemAlignedPosition.displayName = ITEM_ALIGNED_POSITION_NAME;
var POPPER_POSITION_NAME = "SelectPopperPosition";
var SelectPopperPosition = React.forwardRef((props, forwardedRef) => {
  const {
    __scopeSelect,
    align = "start",
    collisionPadding = CONTENT_MARGIN,
    ...popperProps
  } = props;
  const popperScope = usePopperScope(__scopeSelect);
  return /* @__PURE__ */ jsx(
    Content$1,
    {
      ...popperScope,
      ...popperProps,
      ref: forwardedRef,
      align,
      collisionPadding,
      style: {
        // Ensure border-box for floating-ui calculations
        boxSizing: "border-box",
        ...popperProps.style,
        // re-namespace exposed content custom properties
        ...{
          "--radix-select-content-transform-origin": "var(--radix-popper-transform-origin)",
          "--radix-select-content-available-width": "var(--radix-popper-available-width)",
          "--radix-select-content-available-height": "var(--radix-popper-available-height)",
          "--radix-select-trigger-width": "var(--radix-popper-anchor-width)",
          "--radix-select-trigger-height": "var(--radix-popper-anchor-height)"
        }
      }
    }
  );
});
SelectPopperPosition.displayName = POPPER_POSITION_NAME;
var [SelectViewportProvider, useSelectViewportContext] = createSelectContext(CONTENT_NAME$1, {});
var VIEWPORT_NAME = "SelectViewport";
var SelectViewport = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSelect, nonce, ...viewportProps } = props;
    const contentContext = useSelectContentContext(VIEWPORT_NAME, __scopeSelect);
    const viewportContext = useSelectViewportContext(VIEWPORT_NAME, __scopeSelect);
    const composedRefs = useComposedRefs(forwardedRef, contentContext.onViewportChange);
    const prevScrollTopRef = React.useRef(0);
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        "style",
        {
          dangerouslySetInnerHTML: {
            __html: `[data-radix-select-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-select-viewport]::-webkit-scrollbar{display:none}`
          },
          nonce
        }
      ),
      /* @__PURE__ */ jsx(Collection$1.Slot, { scope: __scopeSelect, children: /* @__PURE__ */ jsx(
        Primitive.div,
        {
          "data-radix-select-viewport": "",
          role: "presentation",
          ...viewportProps,
          ref: composedRefs,
          style: {
            // we use position: 'relative' here on the `viewport` so that when we call
            // `selectedItem.offsetTop` in calculations, the offset is relative to the viewport
            // (independent of the scrollUpButton).
            position: "relative",
            flex: 1,
            // Viewport should only be scrollable in the vertical direction.
            // This won't work in vertical writing modes, so we'll need to
            // revisit this if/when that is supported
            // https://developer.chrome.com/blog/vertical-form-controls
            overflow: "hidden auto",
            ...viewportProps.style
          },
          onScroll: composeEventHandlers(viewportProps.onScroll, (event) => {
            const viewport = event.currentTarget;
            const { contentWrapper, shouldExpandOnScrollRef } = viewportContext;
            if ((shouldExpandOnScrollRef == null ? void 0 : shouldExpandOnScrollRef.current) && contentWrapper) {
              const scrolledBy = Math.abs(prevScrollTopRef.current - viewport.scrollTop);
              if (scrolledBy > 0) {
                const availableHeight = window.innerHeight - CONTENT_MARGIN * 2;
                const cssMinHeight = parseFloat(contentWrapper.style.minHeight);
                const cssHeight = parseFloat(contentWrapper.style.height);
                const prevHeight = Math.max(cssMinHeight, cssHeight);
                if (prevHeight < availableHeight) {
                  const nextHeight = prevHeight + scrolledBy;
                  const clampedNextHeight = Math.min(availableHeight, nextHeight);
                  const heightDiff = nextHeight - clampedNextHeight;
                  contentWrapper.style.height = clampedNextHeight + "px";
                  if (contentWrapper.style.bottom === "0px") {
                    viewport.scrollTop = heightDiff > 0 ? heightDiff : 0;
                    contentWrapper.style.justifyContent = "flex-end";
                  }
                }
              }
            }
            prevScrollTopRef.current = viewport.scrollTop;
          })
        }
      ) })
    ] });
  }
);
SelectViewport.displayName = VIEWPORT_NAME;
var GROUP_NAME$1 = "SelectGroup";
var [SelectGroupContextProvider, useSelectGroupContext] = createSelectContext(GROUP_NAME$1);
var SelectGroup$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSelect, ...groupProps } = props;
    const groupId = useId();
    return /* @__PURE__ */ jsx(SelectGroupContextProvider, { scope: __scopeSelect, id: groupId, children: /* @__PURE__ */ jsx(Primitive.div, { role: "group", "aria-labelledby": groupId, ...groupProps, ref: forwardedRef }) });
  }
);
SelectGroup$1.displayName = GROUP_NAME$1;
var LABEL_NAME = "SelectLabel";
var SelectLabel$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSelect, ...labelProps } = props;
    const groupContext = useSelectGroupContext(LABEL_NAME, __scopeSelect);
    return /* @__PURE__ */ jsx(Primitive.div, { id: groupContext.id, ...labelProps, ref: forwardedRef });
  }
);
SelectLabel$1.displayName = LABEL_NAME;
var ITEM_NAME$1 = "SelectItem";
var [SelectItemContextProvider, useSelectItemContext] = createSelectContext(ITEM_NAME$1);
var SelectItem$1 = React.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeSelect,
      value,
      disabled = false,
      textValue: textValueProp,
      ...itemProps
    } = props;
    const context = useSelectContext(ITEM_NAME$1, __scopeSelect);
    const contentContext = useSelectContentContext(ITEM_NAME$1, __scopeSelect);
    const isSelected = context.value === value;
    const [textValue, setTextValue] = React.useState(textValueProp ?? "");
    const [isFocused, setIsFocused] = React.useState(false);
    const composedRefs = useComposedRefs(
      forwardedRef,
      (node) => {
        var _a;
        return (_a = contentContext.itemRefCallback) == null ? void 0 : _a.call(contentContext, node, value, disabled);
      }
    );
    const textId = useId();
    const pointerTypeRef = React.useRef("touch");
    const handleSelect = () => {
      if (!disabled) {
        context.onValueChange(value);
        context.onOpenChange(false);
      }
    };
    if (value === "") {
      throw new Error(
        "A <Select.Item /> must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder."
      );
    }
    return /* @__PURE__ */ jsx(
      SelectItemContextProvider,
      {
        scope: __scopeSelect,
        value,
        disabled,
        textId,
        isSelected,
        onItemTextChange: React.useCallback((node) => {
          setTextValue((prevTextValue) => prevTextValue || ((node == null ? void 0 : node.textContent) ?? "").trim());
        }, []),
        children: /* @__PURE__ */ jsx(
          Collection$1.ItemSlot,
          {
            scope: __scopeSelect,
            value,
            disabled,
            textValue,
            children: /* @__PURE__ */ jsx(
              Primitive.div,
              {
                role: "option",
                "aria-labelledby": textId,
                "data-highlighted": isFocused ? "" : void 0,
                "aria-selected": isSelected && isFocused,
                "data-state": isSelected ? "checked" : "unchecked",
                "aria-disabled": disabled || void 0,
                "data-disabled": disabled ? "" : void 0,
                tabIndex: disabled ? void 0 : -1,
                ...itemProps,
                ref: composedRefs,
                onFocus: composeEventHandlers(itemProps.onFocus, () => setIsFocused(true)),
                onBlur: composeEventHandlers(itemProps.onBlur, () => setIsFocused(false)),
                onClick: composeEventHandlers(itemProps.onClick, () => {
                  if (pointerTypeRef.current !== "mouse") handleSelect();
                }),
                onPointerUp: composeEventHandlers(itemProps.onPointerUp, () => {
                  if (pointerTypeRef.current === "mouse") handleSelect();
                }),
                onPointerDown: composeEventHandlers(itemProps.onPointerDown, (event) => {
                  pointerTypeRef.current = event.pointerType;
                }),
                onPointerMove: composeEventHandlers(itemProps.onPointerMove, (event) => {
                  var _a;
                  pointerTypeRef.current = event.pointerType;
                  if (disabled) {
                    (_a = contentContext.onItemLeave) == null ? void 0 : _a.call(contentContext);
                  } else if (pointerTypeRef.current === "mouse") {
                    event.currentTarget.focus({ preventScroll: true });
                  }
                }),
                onPointerLeave: composeEventHandlers(itemProps.onPointerLeave, (event) => {
                  var _a;
                  if (event.currentTarget === document.activeElement) {
                    (_a = contentContext.onItemLeave) == null ? void 0 : _a.call(contentContext);
                  }
                }),
                onKeyDown: composeEventHandlers(itemProps.onKeyDown, (event) => {
                  var _a;
                  const isTypingAhead = ((_a = contentContext.searchRef) == null ? void 0 : _a.current) !== "";
                  if (isTypingAhead && event.key === " ") return;
                  if (SELECTION_KEYS.includes(event.key)) handleSelect();
                  if (event.key === " ") event.preventDefault();
                })
              }
            )
          }
        )
      }
    );
  }
);
SelectItem$1.displayName = ITEM_NAME$1;
var ITEM_TEXT_NAME = "SelectItemText";
var SelectItemText = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSelect, className, style, ...itemTextProps } = props;
    const context = useSelectContext(ITEM_TEXT_NAME, __scopeSelect);
    const contentContext = useSelectContentContext(ITEM_TEXT_NAME, __scopeSelect);
    const itemContext = useSelectItemContext(ITEM_TEXT_NAME, __scopeSelect);
    const nativeOptionsContext = useSelectNativeOptionsContext(ITEM_TEXT_NAME, __scopeSelect);
    const [itemTextNode, setItemTextNode] = React.useState(null);
    const composedRefs = useComposedRefs(
      forwardedRef,
      (node) => setItemTextNode(node),
      itemContext.onItemTextChange,
      (node) => {
        var _a;
        return (_a = contentContext.itemTextRefCallback) == null ? void 0 : _a.call(contentContext, node, itemContext.value, itemContext.disabled);
      }
    );
    const textContent = itemTextNode == null ? void 0 : itemTextNode.textContent;
    const nativeOption = React.useMemo(
      () => /* @__PURE__ */ jsx("option", { value: itemContext.value, disabled: itemContext.disabled, children: textContent }, itemContext.value),
      [itemContext.disabled, itemContext.value, textContent]
    );
    const { onNativeOptionAdd, onNativeOptionRemove } = nativeOptionsContext;
    useLayoutEffect2(() => {
      onNativeOptionAdd(nativeOption);
      return () => onNativeOptionRemove(nativeOption);
    }, [onNativeOptionAdd, onNativeOptionRemove, nativeOption]);
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Primitive.span, { id: itemContext.textId, ...itemTextProps, ref: composedRefs }),
      itemContext.isSelected && context.valueNode && !context.valueNodeHasChildren ? ReactDOM.createPortal(itemTextProps.children, context.valueNode) : null
    ] });
  }
);
SelectItemText.displayName = ITEM_TEXT_NAME;
var ITEM_INDICATOR_NAME = "SelectItemIndicator";
var SelectItemIndicator = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSelect, ...itemIndicatorProps } = props;
    const itemContext = useSelectItemContext(ITEM_INDICATOR_NAME, __scopeSelect);
    return itemContext.isSelected ? /* @__PURE__ */ jsx(Primitive.span, { "aria-hidden": true, ...itemIndicatorProps, ref: forwardedRef }) : null;
  }
);
SelectItemIndicator.displayName = ITEM_INDICATOR_NAME;
var SCROLL_UP_BUTTON_NAME = "SelectScrollUpButton";
var SelectScrollUpButton$1 = React.forwardRef((props, forwardedRef) => {
  const contentContext = useSelectContentContext(SCROLL_UP_BUTTON_NAME, props.__scopeSelect);
  const viewportContext = useSelectViewportContext(SCROLL_UP_BUTTON_NAME, props.__scopeSelect);
  const [canScrollUp, setCanScrollUp] = React.useState(false);
  const composedRefs = useComposedRefs(forwardedRef, viewportContext.onScrollButtonChange);
  useLayoutEffect2(() => {
    if (contentContext.viewport && contentContext.isPositioned) {
      let handleScroll2 = function() {
        const canScrollUp2 = viewport.scrollTop > 0;
        setCanScrollUp(canScrollUp2);
      };
      const viewport = contentContext.viewport;
      handleScroll2();
      viewport.addEventListener("scroll", handleScroll2);
      return () => viewport.removeEventListener("scroll", handleScroll2);
    }
  }, [contentContext.viewport, contentContext.isPositioned]);
  return canScrollUp ? /* @__PURE__ */ jsx(
    SelectScrollButtonImpl,
    {
      ...props,
      ref: composedRefs,
      onAutoScroll: () => {
        const { viewport, selectedItem } = contentContext;
        if (viewport && selectedItem) {
          viewport.scrollTop = viewport.scrollTop - selectedItem.offsetHeight;
        }
      }
    }
  ) : null;
});
SelectScrollUpButton$1.displayName = SCROLL_UP_BUTTON_NAME;
var SCROLL_DOWN_BUTTON_NAME = "SelectScrollDownButton";
var SelectScrollDownButton$1 = React.forwardRef((props, forwardedRef) => {
  const contentContext = useSelectContentContext(SCROLL_DOWN_BUTTON_NAME, props.__scopeSelect);
  const viewportContext = useSelectViewportContext(SCROLL_DOWN_BUTTON_NAME, props.__scopeSelect);
  const [canScrollDown, setCanScrollDown] = React.useState(false);
  const composedRefs = useComposedRefs(forwardedRef, viewportContext.onScrollButtonChange);
  useLayoutEffect2(() => {
    if (contentContext.viewport && contentContext.isPositioned) {
      let handleScroll2 = function() {
        const maxScroll = viewport.scrollHeight - viewport.clientHeight;
        const canScrollDown2 = Math.ceil(viewport.scrollTop) < maxScroll;
        setCanScrollDown(canScrollDown2);
      };
      const viewport = contentContext.viewport;
      handleScroll2();
      viewport.addEventListener("scroll", handleScroll2);
      return () => viewport.removeEventListener("scroll", handleScroll2);
    }
  }, [contentContext.viewport, contentContext.isPositioned]);
  return canScrollDown ? /* @__PURE__ */ jsx(
    SelectScrollButtonImpl,
    {
      ...props,
      ref: composedRefs,
      onAutoScroll: () => {
        const { viewport, selectedItem } = contentContext;
        if (viewport && selectedItem) {
          viewport.scrollTop = viewport.scrollTop + selectedItem.offsetHeight;
        }
      }
    }
  ) : null;
});
SelectScrollDownButton$1.displayName = SCROLL_DOWN_BUTTON_NAME;
var SelectScrollButtonImpl = React.forwardRef((props, forwardedRef) => {
  const { __scopeSelect, onAutoScroll, ...scrollIndicatorProps } = props;
  const contentContext = useSelectContentContext("SelectScrollButton", __scopeSelect);
  const autoScrollTimerRef = React.useRef(null);
  const getItems = useCollection$1(__scopeSelect);
  const clearAutoScrollTimer = React.useCallback(() => {
    if (autoScrollTimerRef.current !== null) {
      window.clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);
  React.useEffect(() => {
    return () => clearAutoScrollTimer();
  }, [clearAutoScrollTimer]);
  useLayoutEffect2(() => {
    var _a;
    const activeItem = getItems().find((item) => item.ref.current === document.activeElement);
    (_a = activeItem == null ? void 0 : activeItem.ref.current) == null ? void 0 : _a.scrollIntoView({ block: "nearest" });
  }, [getItems]);
  return /* @__PURE__ */ jsx(
    Primitive.div,
    {
      "aria-hidden": true,
      ...scrollIndicatorProps,
      ref: forwardedRef,
      style: { flexShrink: 0, ...scrollIndicatorProps.style },
      onPointerDown: composeEventHandlers(scrollIndicatorProps.onPointerDown, () => {
        if (autoScrollTimerRef.current === null) {
          autoScrollTimerRef.current = window.setInterval(onAutoScroll, 50);
        }
      }),
      onPointerMove: composeEventHandlers(scrollIndicatorProps.onPointerMove, () => {
        var _a;
        (_a = contentContext.onItemLeave) == null ? void 0 : _a.call(contentContext);
        if (autoScrollTimerRef.current === null) {
          autoScrollTimerRef.current = window.setInterval(onAutoScroll, 50);
        }
      }),
      onPointerLeave: composeEventHandlers(scrollIndicatorProps.onPointerLeave, () => {
        clearAutoScrollTimer();
      })
    }
  );
});
var SEPARATOR_NAME = "SelectSeparator";
var SelectSeparator$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSelect, ...separatorProps } = props;
    return /* @__PURE__ */ jsx(Primitive.div, { "aria-hidden": true, ...separatorProps, ref: forwardedRef });
  }
);
SelectSeparator$1.displayName = SEPARATOR_NAME;
var ARROW_NAME = "SelectArrow";
var SelectArrow = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSelect, ...arrowProps } = props;
    const popperScope = usePopperScope(__scopeSelect);
    const context = useSelectContext(ARROW_NAME, __scopeSelect);
    const contentContext = useSelectContentContext(ARROW_NAME, __scopeSelect);
    return context.open && contentContext.position === "popper" ? /* @__PURE__ */ jsx(Arrow, { ...popperScope, ...arrowProps, ref: forwardedRef }) : null;
  }
);
SelectArrow.displayName = ARROW_NAME;
var BUBBLE_INPUT_NAME = "SelectBubbleInput";
var SelectBubbleInput = React.forwardRef(
  ({ __scopeSelect, value, ...props }, forwardedRef) => {
    const ref = React.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    const prevValue = usePrevious(value);
    React.useEffect(() => {
      const select = ref.current;
      if (!select) return;
      const selectProto = window.HTMLSelectElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(
        selectProto,
        "value"
      );
      const setValue = descriptor.set;
      if (prevValue !== value && setValue) {
        const event = new Event("change", { bubbles: true });
        setValue.call(select, value);
        select.dispatchEvent(event);
      }
    }, [prevValue, value]);
    return /* @__PURE__ */ jsx(
      Primitive.select,
      {
        ...props,
        style: { ...VISUALLY_HIDDEN_STYLES, ...props.style },
        ref: composedRefs,
        defaultValue: value
      }
    );
  }
);
SelectBubbleInput.displayName = BUBBLE_INPUT_NAME;
function shouldShowPlaceholder(value) {
  return value === "" || value === void 0;
}
function useTypeaheadSearch(onSearchChange) {
  const handleSearchChange = useCallbackRef$1(onSearchChange);
  const searchRef = React.useRef("");
  const timerRef = React.useRef(0);
  const handleTypeaheadSearch = React.useCallback(
    (key) => {
      const search = searchRef.current + key;
      handleSearchChange(search);
      (function updateSearch(value) {
        searchRef.current = value;
        window.clearTimeout(timerRef.current);
        if (value !== "") timerRef.current = window.setTimeout(() => updateSearch(""), 1e3);
      })(search);
    },
    [handleSearchChange]
  );
  const resetTypeahead = React.useCallback(() => {
    searchRef.current = "";
    window.clearTimeout(timerRef.current);
  }, []);
  React.useEffect(() => {
    return () => window.clearTimeout(timerRef.current);
  }, []);
  return [searchRef, handleTypeaheadSearch, resetTypeahead];
}
function findNextItem(items, search, currentItem) {
  const isRepeated = search.length > 1 && Array.from(search).every((char) => char === search[0]);
  const normalizedSearch = isRepeated ? search[0] : search;
  const currentItemIndex = currentItem ? items.indexOf(currentItem) : -1;
  let wrappedItems = wrapArray$1(items, Math.max(currentItemIndex, 0));
  const excludeCurrentItem = normalizedSearch.length === 1;
  if (excludeCurrentItem) wrappedItems = wrappedItems.filter((v) => v !== currentItem);
  const nextItem = wrappedItems.find(
    (item) => item.textValue.toLowerCase().startsWith(normalizedSearch.toLowerCase())
  );
  return nextItem !== currentItem ? nextItem : void 0;
}
function wrapArray$1(array, startIndex) {
  return array.map((_, index2) => array[(startIndex + index2) % array.length]);
}
var Root2$1 = Select$1;
var Trigger$1 = SelectTrigger$1;
var Value = SelectValue$1;
var Icon = SelectIcon;
var Portal = SelectPortal;
var Content2 = SelectContent$1;
var Viewport = SelectViewport;
var Label = SelectLabel$1;
var Item$1 = SelectItem$1;
var ItemText = SelectItemText;
var ItemIndicator = SelectItemIndicator;
var ScrollUpButton = SelectScrollUpButton$1;
var ScrollDownButton = SelectScrollDownButton$1;
var Separator = SelectSeparator$1;
const Select = Root2$1;
const SelectValue = Value;
const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => jsxs(Trigger$1, { ref, className: cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1", className), ...props, children: [children, jsx(Icon, { asChild: true, children: jsx(ChevronDown, { className: "h-4 w-4 opacity-50" }) })] }));
SelectTrigger.displayName = Trigger$1.displayName;
const SelectScrollUpButton = React.forwardRef(({ className, ...props }, ref) => jsx(ScrollUpButton, { ref, className: cn("flex cursor-default items-center justify-center py-1", className), ...props, children: jsx(ChevronUp, { className: "h-4 w-4" }) }));
SelectScrollUpButton.displayName = ScrollUpButton.displayName;
const SelectScrollDownButton = React.forwardRef(({ className, ...props }, ref) => jsx(ScrollDownButton, { ref, className: cn("flex cursor-default items-center justify-center py-1", className), ...props, children: jsx(ChevronDown, { className: "h-4 w-4" }) }));
SelectScrollDownButton.displayName = ScrollDownButton.displayName;
const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => jsx(Portal, { children: jsxs(Content2, { ref, className: cn("relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1", className), position, ...props, children: [jsx(SelectScrollUpButton, {}), jsx(Viewport, { className: cn("p-1", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"), children }), jsx(SelectScrollDownButton, {})] }) }));
SelectContent.displayName = Content2.displayName;
const SelectLabel = React.forwardRef(({ className, ...props }, ref) => jsx(Label, { ref, className: cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className), ...props }));
SelectLabel.displayName = Label.displayName;
const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => jsxs(Item$1, { ref, className: cn("relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className), ...props, children: [jsx("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center", children: jsx(ItemIndicator, { children: jsx(Check, { className: "h-4 w-4" }) }) }), jsx(ItemText, { children })] }));
SelectItem.displayName = Item$1.displayName;
const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => jsx(Separator, { ref, className: cn("-mx-1 my-1 h-px bg-muted", className), ...props }));
SelectSeparator.displayName = Separator.displayName;
function deriveKindLabel$1(kind) {
  if (!kind)
    return "";
  return kind.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}
function derivePluralLabel$1(label) {
  if (!label)
    return "";
  const trimmed = label.trim();
  if (trimmed.endsWith("y")) {
    return trimmed.slice(0, -1) + "ies";
  } else if (trimmed.endsWith("s") || trimmed.endsWith("x") || trimmed.endsWith("z") || trimmed.endsWith("ch") || trimmed.endsWith("sh")) {
    return trimmed + "es";
  } else {
    return trimmed + "s";
  }
}
function resourceToKind(resource) {
  if (!resource)
    return "";
  let singular = resource;
  if (singular.endsWith("ies")) {
    singular = singular.slice(0, -3) + "y";
  } else if (singular.endsWith("es")) {
    singular = singular.slice(0, -2);
  } else if (singular.endsWith("s")) {
    singular = singular.slice(0, -1);
  }
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}
const CUSTOM_VALUE = "__custom__";
function PolicyResourceForm({ resource, onChange, client, className = "" }) {
  var _a;
  const [apiGroups, setApiGroups] = useState([]);
  const [resources, setResources] = useState([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [customApiGroup, setCustomApiGroup] = useState(false);
  const [customKind, setCustomKind] = useState(false);
  const derivedKindLabel = useMemo(() => deriveKindLabel$1(resource.kind), [resource.kind]);
  const derivedPluralLabel = useMemo(() => derivePluralLabel$1(resource.kindLabel || derivedKindLabel), [resource.kindLabel, derivedKindLabel]);
  const loadApiGroups = useCallback(async () => {
    if (!client)
      return;
    setIsLoadingGroups(true);
    try {
      const groups = await client.getAuditedAPIGroups();
      setApiGroups(groups.filter((g) => g));
    } catch (err) {
      console.error("Failed to load API groups:", err);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [client]);
  const loadResources = useCallback(async () => {
    var _a2;
    if (!client || !resource.apiGroup) {
      setResources([]);
      return;
    }
    setIsLoadingResources(true);
    try {
      const auditedResources = await client.getAuditedResources(resource.apiGroup);
      let resourceMap = /* @__PURE__ */ new Map();
      try {
        const discoveryResult = await client.discoverAPIResources(resource.apiGroup);
        resourceMap = new Map(((_a2 = discoveryResult.resources) == null ? void 0 : _a2.map((r2) => [r2.name, r2.kind])) || []);
      } catch {
      }
      const resourcesWithKind = auditedResources.filter((r2) => r2).map((r2) => ({
        name: r2,
        kind: resourceMap.get(r2) || resourceToKind(r2)
      }));
      setResources(resourcesWithKind);
    } catch (err) {
      console.error("Failed to load resources:", err);
    } finally {
      setIsLoadingResources(false);
    }
  }, [client, resource.apiGroup]);
  useEffect(() => {
    if (client) {
      loadApiGroups();
    }
  }, [client, loadApiGroups]);
  useEffect(() => {
    if (client && resource.apiGroup) {
      loadResources();
    }
  }, [client, resource.apiGroup, loadResources]);
  useEffect(() => {
    if (resource.apiGroup && apiGroups.length > 0 && !apiGroups.includes(resource.apiGroup)) {
      setCustomApiGroup(true);
    }
  }, [resource.apiGroup, apiGroups]);
  useEffect(() => {
    if (resource.kind && resources.length > 0) {
      const kindInList = resources.some((r2) => r2.kind === resource.kind);
      if (!kindInList) {
        setCustomKind(true);
      }
    }
  }, [resource.kind, resources]);
  const handleApiGroupSelectChange = (value) => {
    if (value === CUSTOM_VALUE) {
      setCustomApiGroup(true);
    } else {
      setCustomApiGroup(false);
      onChange({ ...resource, apiGroup: value, kind: "" });
    }
  };
  const handleApiGroupInputChange = (e) => {
    onChange({ ...resource, apiGroup: e.target.value, kind: "" });
  };
  const handleKindSelectChange = (value) => {
    if (value === CUSTOM_VALUE) {
      setCustomKind(true);
    } else {
      setCustomKind(false);
      const selectedResource = resources.find((r2) => r2.name === value);
      const kind = (selectedResource == null ? void 0 : selectedResource.kind) || resourceToKind(value);
      onChange({ ...resource, kind });
    }
  };
  const handleKindInputChange = (e) => {
    onChange({ ...resource, kind: e.target.value });
  };
  const handleKindLabelChange = (e) => {
    onChange({ ...resource, kindLabel: e.target.value || void 0 });
  };
  const handleKindLabelPluralChange = (e) => {
    onChange({ ...resource, kindLabelPlural: e.target.value || void 0 });
  };
  const handleBackToSelect = (field) => {
    if (field === "apiGroup") {
      setCustomApiGroup(false);
      onChange({ ...resource, apiGroup: "", kind: "" });
    } else {
      setCustomKind(false);
      onChange({ ...resource, kind: "" });
    }
  };
  const apiGroupInList = apiGroups.includes(resource.apiGroup);
  const currentResourceName = ((_a = resources.find((r2) => r2.kind === resource.kind)) == null ? void 0 : _a.name) || "";
  return jsxs("div", { className: `rounded-lg bg-muted p-6 ${className}`, children: [jsx("h4", { className: "mb-2 text-base font-medium text-foreground", children: "Resource Target" }), jsxs("p", { className: "mb-6 text-sm text-muted-foreground", children: ["Define which API group and kind this policy applies to.", client && jsxs("span", { className: "italic text-muted-foreground/70", children: [" ", "Options based on audit events in your cluster."] })] }), jsxs("div", { className: "mb-5 last:mb-0", children: [jsxs(Label$1, { htmlFor: "resource-apiGroup", className: "mb-1.5 block text-foreground/80", children: ["API Group ", jsx("span", { className: "text-destructive", children: "*" })] }), client && !customApiGroup ? jsx("div", { className: "relative", children: jsxs(Select, { value: apiGroupInList ? resource.apiGroup : "", onValueChange: handleApiGroupSelectChange, disabled: isLoadingGroups, children: [jsx(SelectTrigger, { className: "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-all duration-200 focus:border-[#BF9595] focus:outline-none focus:ring-[3px] focus:ring-[#BF9595]/10 disabled:cursor-not-allowed disabled:opacity-50", children: jsx(SelectValue, { placeholder: isLoadingGroups ? "Loading..." : "Select an API Group..." }) }), jsxs(SelectContent, { children: [apiGroups.length === 0 && !isLoadingGroups && jsx(SelectItem, { value: CUSTOM_VALUE, disabled: true, className: "italic text-muted-foreground", children: "No API groups found" }), apiGroups.map((group) => jsx(SelectItem, { value: group, children: group }, group)), jsx(SelectItem, { value: CUSTOM_VALUE, className: "italic text-muted-foreground", children: "Enter custom value..." })] })] }) }) : jsxs("div", { className: "flex gap-2", children: [jsx(Input, { id: "resource-apiGroup", type: "text", className: "flex-1", value: resource.apiGroup, onChange: handleApiGroupInputChange, placeholder: "e.g., networking.datumapis.com" }), client && jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => handleBackToSelect("apiGroup"), title: "Back to select", children: "Back to list" })] })] }), jsxs("div", { className: "mb-5 last:mb-0", children: [jsxs(Label$1, { htmlFor: "resource-kind", className: "mb-1.5 block text-foreground/80", children: ["Kind ", jsx("span", { className: "text-destructive", children: "*" })] }), client && !customKind ? jsx("div", { className: "relative", children: jsxs(Select, { value: currentResourceName, onValueChange: handleKindSelectChange, disabled: isLoadingResources || !resource.apiGroup, children: [jsx(SelectTrigger, { className: "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-all duration-200 focus:border-[#BF9595] focus:outline-none focus:ring-[3px] focus:ring-[#BF9595]/10 disabled:cursor-not-allowed disabled:opacity-50", children: jsx(SelectValue, { placeholder: !resource.apiGroup ? "Select API Group first..." : isLoadingResources ? "Loading..." : "Select a Kind..." }) }), jsxs(SelectContent, { children: [resources.length === 0 && resource.apiGroup && !isLoadingResources && jsx(SelectItem, { value: CUSTOM_VALUE, disabled: true, className: "italic text-muted-foreground", children: "No resources found" }), resources.map((res) => jsx(SelectItem, { value: res.name, children: res.kind }, res.name)), jsx(SelectItem, { value: CUSTOM_VALUE, className: "italic text-muted-foreground", children: "Enter custom value..." })] })] }) }) : jsxs("div", { className: "flex gap-2", children: [jsx(Input, { id: "resource-kind", type: "text", className: "flex-1", value: resource.kind, onChange: handleKindInputChange, placeholder: resource.apiGroup ? "e.g., HTTPProxy" : "Select API Group first", disabled: !resource.apiGroup }), client && jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => handleBackToSelect("kind"), title: "Back to select", children: "Back to list" })] }), jsx("div", { className: "mt-1.5 text-xs text-muted-foreground", children: "The Kubernetes resource kind (e.g., HTTPProxy, Gateway, Deployment)" })] }), jsxs("div", { className: "mb-5 last:mb-0", children: [jsx(Label$1, { htmlFor: "resource-kindLabel", className: "mb-1.5 block text-foreground/80", children: "Kind Label" }), jsx(Input, { id: "resource-kindLabel", type: "text", value: resource.kindLabel || "", onChange: handleKindLabelChange, placeholder: derivedKindLabel || "Auto-derived from Kind" }), jsxs("div", { className: "mt-1.5 text-xs text-muted-foreground", children: ["Human-readable label for the kind. Used in activity summaries.", derivedKindLabel && !resource.kindLabel && jsxs("span", { className: "font-medium text-emerald-600", children: [' Default: "', derivedKindLabel, '"'] })] })] }), jsxs("div", { className: "mb-5 last:mb-0", children: [jsx(Label$1, { htmlFor: "resource-kindLabelPlural", className: "mb-1.5 block text-foreground/80", children: "Kind Label (Plural)" }), jsx(Input, { id: "resource-kindLabelPlural", type: "text", value: resource.kindLabelPlural || "", onChange: handleKindLabelPluralChange, placeholder: derivedPluralLabel || "Auto-derived from Kind Label" }), jsxs("div", { className: "mt-1.5 text-xs text-muted-foreground", children: ["Plural form of the kind label.", derivedPluralLabel && !resource.kindLabelPlural && jsxs("span", { className: "font-medium text-emerald-600", children: [' Default: "', derivedPluralLabel, '"'] })] })] })] });
}
const AUDIT_CEL_HELP = {
  variables: [
    { name: "audit.verb", description: "HTTP verb (create, update, patch, delete, get, list, watch)" },
    { name: "audit.user.username", description: "Username of the actor" },
    { name: "audit.user.groups", description: "Groups the actor belongs to" },
    { name: "audit.objectRef.name", description: "Name of the resource" },
    { name: "audit.objectRef.namespace", description: "Namespace of the resource" },
    { name: "audit.objectRef.subresource", description: 'Subresource (e.g., "status")' },
    { name: "audit.responseStatus.code", description: "HTTP response status code" }
  ],
  examples: [
    'audit.verb == "create"',
    'audit.verb in ["create", "update", "patch"]',
    'audit.verb == "update" && audit.objectRef.subresource == "status"',
    "audit.responseStatus.code >= 200 && audit.responseStatus.code < 300"
  ]
};
const EVENT_CEL_HELP = {
  variables: [
    { name: "event.type", description: 'Event type: "Normal" or "Warning"' },
    { name: "event.reason", description: 'Short reason (e.g., "Created", "Ready", "Failed")' },
    { name: "event.message", description: "Human-readable message" },
    { name: "event.involvedObject.name", description: "Name of the involved resource" },
    { name: "event.involvedObject.namespace", description: "Namespace of the involved resource" },
    { name: "event.source.component", description: "Component that generated the event" }
  ],
  examples: [
    'event.reason == "Ready"',
    'event.type == "Warning"',
    'event.reason in ["Created", "Updated", "Deleted"]',
    'event.message.contains("failed")'
  ]
};
const SUMMARY_HELP = {
  variables: [
    { name: "actor.name", description: "Display name of the actor" },
    { name: "actor.email", description: "Email of the actor (if available)" },
    { name: "resource.name", description: "Name of the resource" },
    { name: "resource.namespace", description: "Namespace of the resource" },
    { name: "kindLabel", description: 'Human-readable kind label (e.g., "HTTP Proxy")' },
    { name: "kindLabelPlural", description: 'Plural kind label (e.g., "HTTP Proxies")' }
  ],
  examples: [
    "{{ actor.name }} created {{ kindLabel }} {{ resource.name }}",
    "{{ actor.name }} updated the status of {{ kindLabel }} {{ resource.name }}",
    "{{ kindLabel }} {{ resource.name }} is now ready",
    "{{ kindLabel }} {{ resource.name }} failed: {{ event.message }}"
  ]
};
function PolicyRuleEditor({ rule, index: index2, ruleType, isHighlighted = false, onChange, onDelete, className = "" }) {
  const [showMatchHelp, setShowMatchHelp] = useState(false);
  const [showSummaryHelp, setShowSummaryHelp] = useState(false);
  const celHelp = ruleType === "audit" ? AUDIT_CEL_HELP : EVENT_CEL_HELP;
  const handleMatchChange = (e) => {
    onChange({ ...rule, match: e.target.value });
  };
  const handleSummaryChange = (e) => {
    onChange({ ...rule, summary: e.target.value });
  };
  const insertMatchExample = (example) => {
    onChange({ ...rule, match: example });
  };
  const insertSummaryExample = (example) => {
    onChange({ ...rule, summary: example });
  };
  return jsxs(Card, { className: `mb-4 transition-all duration-200 ${isHighlighted ? "border-emerald-600 bg-emerald-50" : "bg-muted"} ${className}`, children: [jsxs(CardHeader, { className: "flex flex-row justify-between items-center p-4 pb-0", children: [jsxs("span", { className: `text-xs font-semibold uppercase tracking-wide ${isHighlighted ? "text-emerald-600" : "text-muted-foreground"}`, children: [ruleType === "audit" ? "Audit" : "Event", " Rule #", index2 + 1] }), jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "w-6 h-6 text-xl leading-none text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400", onClick: onDelete, title: "Delete rule", children: "×" })] }), jsxs(CardContent, { className: "p-4", children: [jsxs("div", { className: "mb-4", children: [jsxs("div", { className: "flex justify-between items-center mb-1.5", children: [jsx(Label$1, { htmlFor: `rule-${index2}-match`, children: "Match Expression (CEL)" }), jsx(Button, { type: "button", variant: "outline", size: "sm", className: "px-2 py-0.5 h-auto text-xs", onClick: () => setShowMatchHelp(!showMatchHelp), children: showMatchHelp ? "Hide Help" : "Show Help" })] }), jsx(Textarea, { id: `rule-${index2}-match`, className: "font-mono text-sm resize-y min-h-[60px]", value: rule.match, onChange: handleMatchChange, placeholder: `e.g., ${celHelp.examples[0]}`, rows: 2, spellCheck: false }), showMatchHelp && jsxs("div", { className: "mt-3 p-4 bg-background border border-border rounded-md text-xs", children: [jsxs("div", { className: "mb-4 last:mb-0", children: [jsx("strong", { className: "block mb-2 text-foreground", children: "Available Variables:" }), jsx("ul", { className: "m-0 pl-5 list-disc", children: celHelp.variables.map((v) => jsxs("li", { className: "mb-1", children: [jsx("code", { className: "bg-muted px-1.5 py-0.5 rounded text-xs", children: v.name }), " - ", v.description] }, v.name)) })] }), jsxs("div", { className: "mb-4 last:mb-0", children: [jsx("strong", { className: "block mb-2 text-foreground", children: "Examples:" }), jsx("ul", { className: "m-0 p-0 list-none", children: celHelp.examples.map((ex, i) => jsxs("li", { className: "flex items-center gap-2 mb-1.5 px-2 py-1.5 bg-muted rounded", children: [jsx("code", { className: "flex-1 text-xs break-all", children: ex }), jsx(Button, { type: "button", size: "sm", className: "px-2 py-0.5 h-auto bg-[#E6F59F] border-none text-[0.625rem] font-medium text-[#0C1D31] uppercase hover:bg-[#d9e88c]", onClick: () => insertMatchExample(ex), children: "Use" })] }, i)) })] })] })] }), jsxs("div", { className: "mb-4 last:mb-0", children: [jsxs("div", { className: "flex justify-between items-center mb-1.5", children: [jsx(Label$1, { htmlFor: `rule-${index2}-summary`, children: "Summary Template (CEL)" }), jsx(Button, { type: "button", variant: "outline", size: "sm", className: "px-2 py-0.5 h-auto text-xs", onClick: () => setShowSummaryHelp(!showSummaryHelp), children: showSummaryHelp ? "Hide Help" : "Show Help" })] }), jsx(Textarea, { id: `rule-${index2}-summary`, className: "font-mono text-sm resize-y min-h-[60px]", value: rule.summary, onChange: handleSummaryChange, placeholder: `e.g., ${SUMMARY_HELP.examples[0]}`, rows: 2, spellCheck: false }), showSummaryHelp && jsxs("div", { className: "mt-3 p-4 bg-background border border-border rounded-md text-xs", children: [jsxs("div", { className: "mb-4 last:mb-0", children: [jsx("strong", { className: "block mb-2 text-foreground", children: "Available Variables:" }), jsx("ul", { className: "m-0 pl-5 list-disc", children: SUMMARY_HELP.variables.map((v) => jsxs("li", { className: "mb-1", children: [jsx("code", { className: "bg-muted px-1.5 py-0.5 rounded text-xs", children: "{{ " + v.name + " }}" }), " - ", v.description] }, v.name)) })] }), jsxs("div", { className: "mb-4 last:mb-0", children: [jsx("strong", { className: "block mb-2 text-foreground", children: "Examples:" }), jsx("ul", { className: "m-0 p-0 list-none", children: SUMMARY_HELP.examples.map((ex, i) => jsxs("li", { className: "flex items-center gap-2 mb-1.5 px-2 py-1.5 bg-muted rounded", children: [jsx("code", { className: "flex-1 text-xs break-all", children: ex }), jsx(Button, { type: "button", size: "sm", className: "px-2 py-0.5 h-auto bg-[#E6F59F] border-none text-[0.625rem] font-medium text-[#0C1D31] uppercase hover:bg-[#d9e88c]", onClick: () => insertSummaryExample(ex), children: "Use" })] }, i)) })] })] })] })] })] });
}
var ENTRY_FOCUS = "rovingFocusGroup.onEntryFocus";
var EVENT_OPTIONS = { bubbles: false, cancelable: true };
var GROUP_NAME = "RovingFocusGroup";
var [Collection, useCollection, createCollectionScope] = createCollection(GROUP_NAME);
var [createRovingFocusGroupContext, createRovingFocusGroupScope] = createContextScope(
  GROUP_NAME,
  [createCollectionScope]
);
var [RovingFocusProvider, useRovingFocusContext] = createRovingFocusGroupContext(GROUP_NAME);
var RovingFocusGroup = React.forwardRef(
  (props, forwardedRef) => {
    return /* @__PURE__ */ jsx(Collection.Provider, { scope: props.__scopeRovingFocusGroup, children: /* @__PURE__ */ jsx(Collection.Slot, { scope: props.__scopeRovingFocusGroup, children: /* @__PURE__ */ jsx(RovingFocusGroupImpl, { ...props, ref: forwardedRef }) }) });
  }
);
RovingFocusGroup.displayName = GROUP_NAME;
var RovingFocusGroupImpl = React.forwardRef((props, forwardedRef) => {
  const {
    __scopeRovingFocusGroup,
    orientation,
    loop = false,
    dir,
    currentTabStopId: currentTabStopIdProp,
    defaultCurrentTabStopId,
    onCurrentTabStopIdChange,
    onEntryFocus,
    preventScrollOnEntryFocus = false,
    ...groupProps
  } = props;
  const ref = React.useRef(null);
  const composedRefs = useComposedRefs(forwardedRef, ref);
  const direction = useDirection(dir);
  const [currentTabStopId, setCurrentTabStopId] = useControllableState({
    prop: currentTabStopIdProp,
    defaultProp: defaultCurrentTabStopId ?? null,
    onChange: onCurrentTabStopIdChange,
    caller: GROUP_NAME
  });
  const [isTabbingBackOut, setIsTabbingBackOut] = React.useState(false);
  const handleEntryFocus = useCallbackRef$1(onEntryFocus);
  const getItems = useCollection(__scopeRovingFocusGroup);
  const isClickFocusRef = React.useRef(false);
  const [focusableItemsCount, setFocusableItemsCount] = React.useState(0);
  React.useEffect(() => {
    const node = ref.current;
    if (node) {
      node.addEventListener(ENTRY_FOCUS, handleEntryFocus);
      return () => node.removeEventListener(ENTRY_FOCUS, handleEntryFocus);
    }
  }, [handleEntryFocus]);
  return /* @__PURE__ */ jsx(
    RovingFocusProvider,
    {
      scope: __scopeRovingFocusGroup,
      orientation,
      dir: direction,
      loop,
      currentTabStopId,
      onItemFocus: React.useCallback(
        (tabStopId) => setCurrentTabStopId(tabStopId),
        [setCurrentTabStopId]
      ),
      onItemShiftTab: React.useCallback(() => setIsTabbingBackOut(true), []),
      onFocusableItemAdd: React.useCallback(
        () => setFocusableItemsCount((prevCount) => prevCount + 1),
        []
      ),
      onFocusableItemRemove: React.useCallback(
        () => setFocusableItemsCount((prevCount) => prevCount - 1),
        []
      ),
      children: /* @__PURE__ */ jsx(
        Primitive.div,
        {
          tabIndex: isTabbingBackOut || focusableItemsCount === 0 ? -1 : 0,
          "data-orientation": orientation,
          ...groupProps,
          ref: composedRefs,
          style: { outline: "none", ...props.style },
          onMouseDown: composeEventHandlers(props.onMouseDown, () => {
            isClickFocusRef.current = true;
          }),
          onFocus: composeEventHandlers(props.onFocus, (event) => {
            const isKeyboardFocus = !isClickFocusRef.current;
            if (event.target === event.currentTarget && isKeyboardFocus && !isTabbingBackOut) {
              const entryFocusEvent = new CustomEvent(ENTRY_FOCUS, EVENT_OPTIONS);
              event.currentTarget.dispatchEvent(entryFocusEvent);
              if (!entryFocusEvent.defaultPrevented) {
                const items = getItems().filter((item) => item.focusable);
                const activeItem = items.find((item) => item.active);
                const currentItem = items.find((item) => item.id === currentTabStopId);
                const candidateItems = [activeItem, currentItem, ...items].filter(
                  Boolean
                );
                const candidateNodes = candidateItems.map((item) => item.ref.current);
                focusFirst(candidateNodes, preventScrollOnEntryFocus);
              }
            }
            isClickFocusRef.current = false;
          }),
          onBlur: composeEventHandlers(props.onBlur, () => setIsTabbingBackOut(false))
        }
      )
    }
  );
});
var ITEM_NAME = "RovingFocusGroupItem";
var RovingFocusGroupItem = React.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeRovingFocusGroup,
      focusable = true,
      active = false,
      tabStopId,
      children,
      ...itemProps
    } = props;
    const autoId = useId();
    const id = tabStopId || autoId;
    const context = useRovingFocusContext(ITEM_NAME, __scopeRovingFocusGroup);
    const isCurrentTabStop = context.currentTabStopId === id;
    const getItems = useCollection(__scopeRovingFocusGroup);
    const { onFocusableItemAdd, onFocusableItemRemove, currentTabStopId } = context;
    React.useEffect(() => {
      if (focusable) {
        onFocusableItemAdd();
        return () => onFocusableItemRemove();
      }
    }, [focusable, onFocusableItemAdd, onFocusableItemRemove]);
    return /* @__PURE__ */ jsx(
      Collection.ItemSlot,
      {
        scope: __scopeRovingFocusGroup,
        id,
        focusable,
        active,
        children: /* @__PURE__ */ jsx(
          Primitive.span,
          {
            tabIndex: isCurrentTabStop ? 0 : -1,
            "data-orientation": context.orientation,
            ...itemProps,
            ref: forwardedRef,
            onMouseDown: composeEventHandlers(props.onMouseDown, (event) => {
              if (!focusable) event.preventDefault();
              else context.onItemFocus(id);
            }),
            onFocus: composeEventHandlers(props.onFocus, () => context.onItemFocus(id)),
            onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
              if (event.key === "Tab" && event.shiftKey) {
                context.onItemShiftTab();
                return;
              }
              if (event.target !== event.currentTarget) return;
              const focusIntent = getFocusIntent(event, context.orientation, context.dir);
              if (focusIntent !== void 0) {
                if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
                event.preventDefault();
                const items = getItems().filter((item) => item.focusable);
                let candidateNodes = items.map((item) => item.ref.current);
                if (focusIntent === "last") candidateNodes.reverse();
                else if (focusIntent === "prev" || focusIntent === "next") {
                  if (focusIntent === "prev") candidateNodes.reverse();
                  const currentIndex = candidateNodes.indexOf(event.currentTarget);
                  candidateNodes = context.loop ? wrapArray(candidateNodes, currentIndex + 1) : candidateNodes.slice(currentIndex + 1);
                }
                setTimeout(() => focusFirst(candidateNodes));
              }
            }),
            children: typeof children === "function" ? children({ isCurrentTabStop, hasTabStop: currentTabStopId != null }) : children
          }
        )
      }
    );
  }
);
RovingFocusGroupItem.displayName = ITEM_NAME;
var MAP_KEY_TO_FOCUS_INTENT = {
  ArrowLeft: "prev",
  ArrowUp: "prev",
  ArrowRight: "next",
  ArrowDown: "next",
  PageUp: "first",
  Home: "first",
  PageDown: "last",
  End: "last"
};
function getDirectionAwareKey(key, dir) {
  if (dir !== "rtl") return key;
  return key === "ArrowLeft" ? "ArrowRight" : key === "ArrowRight" ? "ArrowLeft" : key;
}
function getFocusIntent(event, orientation, dir) {
  const key = getDirectionAwareKey(event.key, dir);
  if (orientation === "vertical" && ["ArrowLeft", "ArrowRight"].includes(key)) return void 0;
  if (orientation === "horizontal" && ["ArrowUp", "ArrowDown"].includes(key)) return void 0;
  return MAP_KEY_TO_FOCUS_INTENT[key];
}
function focusFirst(candidates, preventScroll = false) {
  const PREVIOUSLY_FOCUSED_ELEMENT = document.activeElement;
  for (const candidate of candidates) {
    if (candidate === PREVIOUSLY_FOCUSED_ELEMENT) return;
    candidate.focus({ preventScroll });
    if (document.activeElement !== PREVIOUSLY_FOCUSED_ELEMENT) return;
  }
}
function wrapArray(array, startIndex) {
  return array.map((_, index2) => array[(startIndex + index2) % array.length]);
}
var Root = RovingFocusGroup;
var Item = RovingFocusGroupItem;
var TABS_NAME = "Tabs";
var [createTabsContext] = createContextScope(TABS_NAME, [
  createRovingFocusGroupScope
]);
var useRovingFocusGroupScope = createRovingFocusGroupScope();
var [TabsProvider, useTabsContext] = createTabsContext(TABS_NAME);
var Tabs$1 = React.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeTabs,
      value: valueProp,
      onValueChange,
      defaultValue,
      orientation = "horizontal",
      dir,
      activationMode = "automatic",
      ...tabsProps
    } = props;
    const direction = useDirection(dir);
    const [value, setValue] = useControllableState({
      prop: valueProp,
      onChange: onValueChange,
      defaultProp: defaultValue ?? "",
      caller: TABS_NAME
    });
    return /* @__PURE__ */ jsx(
      TabsProvider,
      {
        scope: __scopeTabs,
        baseId: useId(),
        value,
        onValueChange: setValue,
        orientation,
        dir: direction,
        activationMode,
        children: /* @__PURE__ */ jsx(
          Primitive.div,
          {
            dir: direction,
            "data-orientation": orientation,
            ...tabsProps,
            ref: forwardedRef
          }
        )
      }
    );
  }
);
Tabs$1.displayName = TABS_NAME;
var TAB_LIST_NAME = "TabsList";
var TabsList$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeTabs, loop = true, ...listProps } = props;
    const context = useTabsContext(TAB_LIST_NAME, __scopeTabs);
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeTabs);
    return /* @__PURE__ */ jsx(
      Root,
      {
        asChild: true,
        ...rovingFocusGroupScope,
        orientation: context.orientation,
        dir: context.dir,
        loop,
        children: /* @__PURE__ */ jsx(
          Primitive.div,
          {
            role: "tablist",
            "aria-orientation": context.orientation,
            ...listProps,
            ref: forwardedRef
          }
        )
      }
    );
  }
);
TabsList$1.displayName = TAB_LIST_NAME;
var TRIGGER_NAME = "TabsTrigger";
var TabsTrigger$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeTabs, value, disabled = false, ...triggerProps } = props;
    const context = useTabsContext(TRIGGER_NAME, __scopeTabs);
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeTabs);
    const triggerId = makeTriggerId(context.baseId, value);
    const contentId = makeContentId(context.baseId, value);
    const isSelected = value === context.value;
    return /* @__PURE__ */ jsx(
      Item,
      {
        asChild: true,
        ...rovingFocusGroupScope,
        focusable: !disabled,
        active: isSelected,
        children: /* @__PURE__ */ jsx(
          Primitive.button,
          {
            type: "button",
            role: "tab",
            "aria-selected": isSelected,
            "aria-controls": contentId,
            "data-state": isSelected ? "active" : "inactive",
            "data-disabled": disabled ? "" : void 0,
            disabled,
            id: triggerId,
            ...triggerProps,
            ref: forwardedRef,
            onMouseDown: composeEventHandlers(props.onMouseDown, (event) => {
              if (!disabled && event.button === 0 && event.ctrlKey === false) {
                context.onValueChange(value);
              } else {
                event.preventDefault();
              }
            }),
            onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
              if ([" ", "Enter"].includes(event.key)) context.onValueChange(value);
            }),
            onFocus: composeEventHandlers(props.onFocus, () => {
              const isAutomaticActivation = context.activationMode !== "manual";
              if (!isSelected && !disabled && isAutomaticActivation) {
                context.onValueChange(value);
              }
            })
          }
        )
      }
    );
  }
);
TabsTrigger$1.displayName = TRIGGER_NAME;
var CONTENT_NAME = "TabsContent";
var TabsContent$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeTabs, value, forceMount, children, ...contentProps } = props;
    const context = useTabsContext(CONTENT_NAME, __scopeTabs);
    const triggerId = makeTriggerId(context.baseId, value);
    const contentId = makeContentId(context.baseId, value);
    const isSelected = value === context.value;
    const isMountAnimationPreventedRef = React.useRef(isSelected);
    React.useEffect(() => {
      const rAF = requestAnimationFrame(() => isMountAnimationPreventedRef.current = false);
      return () => cancelAnimationFrame(rAF);
    }, []);
    return /* @__PURE__ */ jsx(Presence, { present: forceMount || isSelected, children: ({ present }) => /* @__PURE__ */ jsx(
      Primitive.div,
      {
        "data-state": isSelected ? "active" : "inactive",
        "data-orientation": context.orientation,
        role: "tabpanel",
        "aria-labelledby": triggerId,
        hidden: !present,
        id: contentId,
        tabIndex: 0,
        ...contentProps,
        ref: forwardedRef,
        style: {
          ...props.style,
          animationDuration: isMountAnimationPreventedRef.current ? "0s" : void 0
        },
        children: present && children
      }
    ) });
  }
);
TabsContent$1.displayName = CONTENT_NAME;
function makeTriggerId(baseId, value) {
  return `${baseId}-trigger-${value}`;
}
function makeContentId(baseId, value) {
  return `${baseId}-content-${value}`;
}
var Root2 = Tabs$1;
var List = TabsList$1;
var Trigger = TabsTrigger$1;
var Content = TabsContent$1;
const Tabs = Root2;
const TabsList = React.forwardRef(({ className, ...props }, ref) => jsx(List, { ref, className: cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className), ...props }));
TabsList.displayName = List.displayName;
const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => jsx(Trigger, { ref, className: cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm", className), ...props }));
TabsTrigger.displayName = Trigger.displayName;
const TabsContent = React.forwardRef(({ className, ...props }, ref) => jsx(Content, { ref, className: cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className), ...props }));
TabsContent.displayName = Content.displayName;
function PolicyRuleList({ auditRules, eventRules, previewResult, onAuditRulesChange, onEventRulesChange, onAddAuditRule, onAddEventRule, className = "" }) {
  const highlightedAuditIndex = (previewResult == null ? void 0 : previewResult.matched) && previewResult.matchedRuleType === "audit" && previewResult.matchedRuleIndex !== void 0 ? previewResult.matchedRuleIndex : -1;
  const highlightedEventIndex = (previewResult == null ? void 0 : previewResult.matched) && previewResult.matchedRuleType === "event" && previewResult.matchedRuleIndex !== void 0 ? previewResult.matchedRuleIndex : -1;
  const handleAuditRuleChange = (index2, rule) => {
    const newRules = [...auditRules];
    newRules[index2] = rule;
    onAuditRulesChange(newRules);
  };
  const handleAuditRuleDelete = (index2) => {
    const newRules = auditRules.filter((_, i) => i !== index2);
    onAuditRulesChange(newRules);
  };
  const handleEventRuleChange = (index2, rule) => {
    const newRules = [...eventRules];
    newRules[index2] = rule;
    onEventRulesChange(newRules);
  };
  const handleEventRuleDelete = (index2) => {
    const newRules = eventRules.filter((_, i) => i !== index2);
    onEventRulesChange(newRules);
  };
  return jsx("div", { className: `bg-muted rounded-lg overflow-hidden ${className}`, children: jsxs(Tabs, { defaultValue: "audit", className: "w-full", children: [jsxs(TabsList, { className: "w-full rounded-none border-b border-input bg-muted h-auto p-0", children: [jsxs(TabsTrigger, { value: "audit", className: "flex-1 gap-2 py-3 px-4 rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-[#BF9595] data-[state=active]:shadow-none", children: ["Audit Rules", jsx(Badge, { variant: "secondary", className: "data-[state=active]:bg-[#BF9595] data-[state=active]:text-white", children: auditRules.length }), highlightedAuditIndex >= 0 && jsx("span", { className: "text-emerald-600 font-bold", title: "Rule matched in preview", children: "✓" })] }), jsxs(TabsTrigger, { value: "event", className: "flex-1 gap-2 py-3 px-4 rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-[#BF9595] data-[state=active]:shadow-none", children: ["Event Rules", jsx(Badge, { variant: "secondary", className: "data-[state=active]:bg-[#BF9595] data-[state=active]:text-white", children: eventRules.length }), highlightedEventIndex >= 0 && jsx("span", { className: "text-emerald-600 font-bold", title: "Rule matched in preview", children: "✓" })] })] }), jsxs(TabsContent, { value: "audit", className: "mt-0 p-4 bg-background", children: [auditRules.map((rule, index2) => jsx(PolicyRuleEditor, { rule, index: index2, ruleType: "audit", isHighlighted: index2 === highlightedAuditIndex, onChange: (newRule) => handleAuditRuleChange(index2, newRule), onDelete: () => handleAuditRuleDelete(index2) }, index2)), auditRules.length === 0 && jsxs("div", { className: "text-center py-8 px-8 text-muted-foreground", children: [jsx("p", { className: "mb-2", children: "No audit rules defined." }), jsx("p", { className: "text-sm", children: "Audit rules match Kubernetes API audit events (create, update, delete, etc.) and generate activity summaries." })] }), jsx(Button, { type: "button", variant: "outline", className: "w-full py-3 mt-4 border-2 border-dashed border-input bg-muted hover:bg-[#EFEFED] hover:border-[#BF9595] hover:text-foreground", onClick: onAddAuditRule, children: "+ Add Audit Rule" })] }), jsxs(TabsContent, { value: "event", className: "mt-0 p-4 bg-background", children: [eventRules.map((rule, index2) => jsx(PolicyRuleEditor, { rule, index: index2, ruleType: "event", isHighlighted: index2 === highlightedEventIndex, onChange: (newRule) => handleEventRuleChange(index2, newRule), onDelete: () => handleEventRuleDelete(index2) }, index2)), eventRules.length === 0 && jsxs("div", { className: "text-center py-8 px-8 text-muted-foreground", children: [jsx("p", { className: "mb-2", children: "No event rules defined." }), jsx("p", { className: "text-sm", children: "Event rules match Kubernetes Events (Ready, Failed, Progressing, etc.) and generate activity summaries from controller status updates." })] }), jsx(Button, { type: "button", variant: "outline", className: "w-full py-3 mt-4 border-2 border-dashed border-input bg-muted hover:bg-[#EFEFED] hover:border-[#BF9595] hover:text-foreground", onClick: onAddEventRule, children: "+ Add Event Rule" })] })] }) });
}
function getResultStats(results) {
  if (!results || results.length === 0) {
    return { total: 0, matched: 0, errors: 0 };
  }
  return {
    total: results.length,
    matched: results.filter((r2) => r2.matched).length,
    errors: results.filter((r2) => !!r2.error).length
  };
}
function formatActorName(actor) {
  if (!actor)
    return "Unknown";
  if (actor.email)
    return actor.email;
  if (actor.name)
    return actor.name;
  return "Unknown";
}
function formatTimestamp(metadata) {
  if (!(metadata == null ? void 0 : metadata.creationTimestamp))
    return "";
  try {
    const date = new Date(metadata.creationTimestamp);
    return date.toLocaleTimeString();
  } catch {
    return "";
  }
}
function PolicyPreviewResult({ result, onResourceClick, className = "" }) {
  const hasError = !!result.error;
  const activities = result.activities || [];
  const results = result.results || [];
  const stats = getResultStats(results);
  const isLegacyFormat = !results.length && (result.matched !== void 0 || result.generatedSummary);
  if (isLegacyFormat) {
    return jsx(Card, { className, children: jsxs(CardContent, { className: "pt-6", children: [jsxs("div", { className: "flex items-center gap-3 mb-4", children: [hasError ? jsxs(Badge, { variant: "destructive", className: "gap-1", children: [jsx(CircleX, { className: "h-3 w-3" }), "Error"] }) : result.matched ? jsxs(Badge, { variant: "success", className: "gap-1", children: [jsx(CircleCheckBig, { className: "h-3 w-3" }), "Matched"] }) : jsxs(Badge, { variant: "secondary", className: "gap-1", children: [jsx(CircleX, { className: "h-3 w-3" }), "No Match"] }), result.matched && !hasError && result.matchedRuleIndex !== void 0 && jsxs("span", { className: "text-sm text-muted-foreground", children: [result.matchedRuleType === "audit" ? "Audit" : "Event", " Rule #", result.matchedRuleIndex + 1] })] }), hasError && jsxs(Alert, { variant: "destructive", className: "mb-4", children: [jsx(CircleAlert, { className: "h-4 w-4" }), jsx(AlertDescription, { children: jsx("pre", { className: "text-xs font-mono whitespace-pre-wrap", children: result.error }) })] }), result.matched && result.generatedSummary && !hasError && jsxs("div", { className: "space-y-2", children: [jsx("p", { className: "text-sm font-medium text-muted-foreground", children: "Generated Summary:" }), jsx("div", { className: "p-3 rounded-md bg-muted", children: jsx(ActivityFeedSummary, { summary: result.generatedSummary, links: result.generatedLinks, onResourceClick }) })] }), !result.matched && !hasError && jsx("p", { className: "text-sm text-muted-foreground", children: "No rules matched the provided input. Check your match expressions." })] }) });
  }
  return jsxs("div", { className: cn("space-y-4", className), children: [jsx("div", { className: "flex items-center gap-3", children: jsxs("div", { className: "flex items-center gap-2", children: [jsxs(Badge, { variant: stats.matched > 0 ? "success" : "secondary", children: [stats.matched, " matched"] }), jsx("span", { className: "text-muted-foreground", children: "/" }), jsxs("span", { className: "text-sm text-muted-foreground", children: [stats.total, " tested"] }), stats.errors > 0 && jsxs(Fragment, { children: [jsx("span", { className: "text-muted-foreground", children: "/" }), jsxs(Badge, { variant: "destructive", children: [stats.errors, " errors"] })] })] }) }), hasError && jsxs(Alert, { variant: "destructive", children: [jsx(CircleAlert, { className: "h-4 w-4" }), jsx(AlertDescription, { children: jsx("pre", { className: "text-xs font-mono whitespace-pre-wrap", children: result.error }) })] }), activities.length > 0 && jsxs(Card, { children: [jsx(CardHeader, { className: "pb-2", children: jsxs("div", { className: "flex items-center justify-between", children: [jsx(CardTitle, { className: "text-base", children: "Generated Activity Stream" }), jsxs(Badge, { variant: "outline", children: [activities.length, " activities"] })] }) }), jsx(CardContent, { className: "p-0", children: jsx("ul", { className: "divide-y divide-border", children: activities.map((activity, index2) => {
    var _a, _b;
    return jsxs("li", { className: "p-4", children: [jsxs("div", { className: "flex items-center gap-2 mb-2", children: [jsx("span", { className: "font-medium text-sm", children: formatActorName(activity.spec.actor) }), jsx(Badge, { variant: activity.spec.changeSource === "system" ? "secondary" : "outline", className: "text-xs", children: activity.spec.changeSource }), ((_a = activity.metadata) == null ? void 0 : _a.creationTimestamp) && jsxs("span", { className: "text-xs text-muted-foreground flex items-center gap-1", children: [jsx(Clock, { className: "h-3 w-3" }), formatTimestamp(activity.metadata)] })] }), jsx("div", { className: "mb-2", children: jsx(ActivityFeedSummary, { summary: activity.spec.summary, links: activity.spec.links, onResourceClick }) }), jsxs("div", { className: "flex items-center gap-3 text-xs text-muted-foreground", children: [jsx("span", { children: activity.spec.resource.kind && jsxs(Fragment, { children: [activity.spec.resource.namespace && `${activity.spec.resource.namespace}/`, activity.spec.resource.name] }) }), jsxs("span", { children: ["via ", activity.spec.origin.type] })] })] }, ((_b = activity.metadata) == null ? void 0 : _b.name) || index2);
  }) }) })] }), results.length > 0 && results.some((r2) => !r2.matched || r2.error) && jsxs("details", { className: "group", children: [jsxs("summary", { className: "flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors", children: [jsx("span", { className: "group-open:rotate-90 transition-transform", children: "▶" }), stats.total - stats.matched, " inputs did not match", stats.errors > 0 && ` (${stats.errors} with errors)`] }), jsx(Card, { className: "mt-2", children: jsx(CardContent, { className: "p-0", children: jsx("ul", { className: "divide-y divide-border", children: results.filter((r2) => !r2.matched || r2.error).map((inputResult) => jsxs("li", { className: cn("p-3 flex items-center justify-between text-sm", inputResult.error && "bg-destructive/10"), children: [jsxs("span", { className: "text-muted-foreground", children: ["Input #", inputResult.inputIndex + 1] }), inputResult.error ? jsx(Badge, { variant: "destructive", className: "text-xs", children: inputResult.error }) : jsx("span", { className: "text-muted-foreground text-xs", children: "No matching rule" })] }, inputResult.inputIndex)) }) }) })] }), stats.matched === 0 && !hasError && jsxs(Alert, { children: [jsx(CircleAlert, { className: "h-4 w-4" }), jsxs(AlertDescription, { children: ["No rules matched any of the ", stats.total, " input", stats.total !== 1 ? "s" : "", ". Check your match expressions."] })] })] });
}
function formatAuditEventSummary(event) {
  var _a, _b, _c, _d;
  const verb = event.verb || "unknown";
  const resource = ((_a = event.objectRef) == null ? void 0 : _a.resource) || "resource";
  const name = ((_b = event.objectRef) == null ? void 0 : _b.name) || "";
  const user = ((_d = (_c = event.user) == null ? void 0 : _c.username) == null ? void 0 : _d.split("@")[0]) || "unknown";
  return `${user} ${verb} ${resource}${name ? ` "${name}"` : ""}`;
}
function formatEventTime(timestamp) {
  if (!timestamp)
    return "";
  try {
    return format(new Date(timestamp), "MMM d, HH:mm:ss");
  } catch {
    return timestamp;
  }
}
function getVerbVariant(verb) {
  switch (verb) {
    case "create":
      return "success";
    case "update":
    case "patch":
      return "warning";
    case "delete":
      return "destructive";
    default:
      return "secondary";
  }
}
function PolicyPreviewPanel({ inputs, selectedIndices, result, isLoading, error, onInputsChange, onToggleSelection, onSelectAll, onDeselectAll, onRunPreview, onResourceClick, client, policyResource, hasSelection, className = "" }) {
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [loadEventsError, setLoadEventsError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualJson, setManualJson] = useState("");
  const [jsonError, setJsonError] = useState(null);
  const loadRealEvents = useCallback(async () => {
    var _a, _b;
    if (!client)
      return;
    setIsLoadingEvents(true);
    setLoadEventsError(null);
    try {
      const filters = ['verb in ["create", "update", "patch", "delete"]'];
      if (policyResource == null ? void 0 : policyResource.apiGroup) {
        filters.push(`objectRef.apiGroup == "${policyResource.apiGroup}"`);
      }
      if (policyResource == null ? void 0 : policyResource.kind) {
        const resourceName = policyResource.kind.toLowerCase() + "s";
        filters.push(`objectRef.resource == "${resourceName}"`);
      }
      const filter = filters.join(" && ");
      const now = /* @__PURE__ */ new Date();
      const startTime = new Date(now.getTime() - 60 * 60 * 1e3);
      const queryResult = await client.createQuery("preview-events-" + Date.now(), {
        filter,
        limit: 20,
        startTime: startTime.toISOString(),
        endTime: now.toISOString()
      });
      let events = ((_a = queryResult.status) == null ? void 0 : _a.results) || [];
      if (events.length === 0) {
        const longerStartTime = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
        const longerQueryResult = await client.createQuery("preview-events-longer-" + Date.now(), {
          filter,
          limit: 20,
          startTime: longerStartTime.toISOString(),
          endTime: now.toISOString()
        });
        events = ((_b = longerQueryResult.status) == null ? void 0 : _b.results) || [];
        if (events.length === 0) {
          setLoadEventsError((policyResource == null ? void 0 : policyResource.apiGroup) ? `No events found for ${policyResource.apiGroup}/${policyResource.kind || "*"} in the last 24 hours.` : "No events found. Please specify an API Group and Kind first.");
          return;
        }
      }
      const newInputs = events.map((event) => ({
        type: "audit",
        audit: event
      }));
      onInputsChange(newInputs);
    } catch (err) {
      const message2 = err instanceof Error ? err.message : "Failed to load events";
      if (message2.includes("memory limit") || message2.includes("503")) {
        setLoadEventsError("Query too broad. Please specify an API Group and Kind to narrow the search.");
      } else {
        setLoadEventsError(message2);
      }
    } finally {
      setIsLoadingEvents(false);
    }
  }, [client, policyResource, onInputsChange]);
  const handleManualJsonSubmit = useCallback(() => {
    try {
      const parsed = JSON.parse(manualJson);
      let newInputs;
      if (Array.isArray(parsed)) {
        newInputs = parsed.map((item) => {
          if (item.type && (item.audit || item.event)) {
            return item;
          }
          if (item.verb) {
            return { type: "audit", audit: item };
          }
          return { type: "event", event: item };
        });
      } else {
        if (parsed.type && (parsed.audit || parsed.event)) {
          newInputs = [parsed];
        } else if (parsed.verb) {
          newInputs = [{ type: "audit", audit: parsed }];
        } else {
          newInputs = [{ type: "event", event: parsed }];
        }
      }
      onInputsChange(newInputs);
      setJsonError(null);
      setManualJson("");
      setShowAdvanced(false);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }, [manualJson, onInputsChange]);
  const selectedCount = selectedIndices.size;
  const totalCount = inputs.length;
  const canLoadEvents = client && (policyResource == null ? void 0 : policyResource.apiGroup);
  return jsxs("div", { className: cn("space-y-4", className), children: [jsxs("div", { children: [jsx("h3", { className: "text-lg font-semibold text-foreground", children: "Test Policy" }), jsx("p", { className: "text-sm text-muted-foreground", children: "Load audit logs from the API to test your policy rules." })] }), jsx(Card, { children: jsxs(CardContent, { className: "pt-6", children: [!canLoadEvents && jsxs(Alert, { variant: "warning", className: "mb-4", children: [jsx(CircleAlert, { className: "h-4 w-4" }), jsx(AlertDescription, { children: "Select an API Group and Kind above to load relevant audit logs." })] }), canLoadEvents && jsx("div", { className: "mb-4", children: jsxs(Badge, { variant: "outline", className: "bg-lime-100 text-lime-900 border-lime-300 dark:bg-lime-900/50 dark:text-lime-200 dark:border-lime-700 font-mono", children: [policyResource.apiGroup, "/", policyResource.kind || "*"] }) }), jsx(Button, { onClick: loadRealEvents, disabled: isLoadingEvents || !canLoadEvents, className: "w-full", children: isLoadingEvents ? jsxs(Fragment, { children: [jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }), "Loading..."] }) : "Load Audit Logs from API" }), loadEventsError && jsxs(Alert, { variant: "destructive", className: "mt-4", children: [jsx(CircleAlert, { className: "h-4 w-4" }), jsx(AlertDescription, { children: loadEventsError })] })] }) }), inputs.length > 0 && jsxs(Card, { children: [jsx(CardHeader, { className: "pb-2 pt-4 px-4", children: jsxs("div", { className: "flex items-center justify-between", children: [jsxs(CardDescription, { children: [selectedCount, " of ", totalCount, " selected"] }), jsxs("div", { className: "flex gap-2", children: [jsx(Button, { variant: "outline", size: "sm", onClick: onSelectAll, disabled: selectedCount === totalCount, children: "Select All" }), jsx(Button, { variant: "outline", size: "sm", onClick: onDeselectAll, disabled: selectedCount === 0, children: "Clear" })] })] }) }), jsx(CardContent, { className: "p-0", children: jsx("ul", { className: "max-h-64 overflow-y-auto divide-y", children: inputs.map((input, index2) => {
    const event = input.type === "audit" ? input.audit : null;
    const isSelected = selectedIndices.has(index2);
    return jsx("li", { className: cn("transition-colors", isSelected ? "bg-green-50 dark:bg-green-950/50" : "bg-background"), children: jsxs("label", { className: "flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50", children: [jsx(Checkbox, { checked: isSelected, onCheckedChange: () => onToggleSelection(index2), className: "mt-0.5" }), jsxs("span", { className: "flex-1 min-w-0", children: [jsx("span", { className: "block text-sm text-foreground truncate", children: event ? formatAuditEventSummary(event) : "Unknown event" }), jsxs("span", { className: "flex items-center gap-2 mt-1", children: [(event == null ? void 0 : event.requestReceivedTimestamp) && jsx("span", { className: "text-xs text-muted-foreground", children: formatEventTime(event.requestReceivedTimestamp) }), (event == null ? void 0 : event.verb) && jsx(Badge, { variant: getVerbVariant(event.verb), className: "text-xs uppercase", children: event.verb })] })] })] }) }, (event == null ? void 0 : event.auditID) || index2);
  }) }) })] }), inputs.length === 0 && !isLoadingEvents && jsx(Card, { children: jsxs(CardContent, { className: "py-8 text-center", children: [jsx("p", { className: "text-sm text-muted-foreground", children: "No audit logs loaded yet." }), jsx("p", { className: "text-xs text-muted-foreground mt-1", children: 'Click "Load Audit Logs from API" to fetch recent events.' })] }) }), jsxs("div", { children: [jsxs("button", { type: "button", onClick: () => setShowAdvanced(!showAdvanced), className: "flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors", children: [jsx(ChevronRight, { className: cn("h-3 w-3 transition-transform", showAdvanced && "rotate-90") }), "Advanced: Manual JSON Input"] }), showAdvanced && jsx(Card, { className: "mt-2", children: jsxs(CardContent, { className: "pt-4", children: [jsx("p", { className: "text-xs text-muted-foreground mb-2", children: "Paste a raw audit event JSON:" }), jsx(Textarea, { value: manualJson, onChange: (e) => {
    setManualJson(e.target.value);
    setJsonError(null);
  }, rows: 6, placeholder: '{"verb": "create", "user": {"username": "..."}, ...}', spellCheck: false, className: cn("font-mono text-xs", jsonError && "border-destructive") }), jsonError && jsx("p", { className: "text-xs text-destructive mt-1", children: jsonError }), jsx(Button, { variant: "secondary", size: "sm", onClick: handleManualJsonSubmit, disabled: !manualJson.trim(), className: "mt-2", children: "Add from JSON" })] }) })] }), jsx(Button, { onClick: onRunPreview, disabled: isLoading || !hasSelection, className: "w-full", size: "lg", children: isLoading ? jsxs(Fragment, { children: [jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }), "Running Preview..."] }) : jsxs(Fragment, { children: ["Run Preview", selectedCount > 0 && ` (${selectedCount} event${selectedCount !== 1 ? "s" : ""})`] }) }), error && !result && jsxs(Alert, { variant: "destructive", children: [jsx(CircleAlert, { className: "h-4 w-4" }), jsx(AlertDescription, { children: error.message })] }), result && jsx(PolicyPreviewResult, { result, onResourceClick })] });
}
function PolicyEditor({ client, policyName, onSaveSuccess, onCancel, onResourceClick, className = "" }) {
  const editor = usePolicyEditor({
    client,
    initialPolicyName: policyName
  });
  const preview = usePolicyPreview({ client });
  useEffect(() => {
    if (policyName) {
      editor.load(policyName).catch((err) => {
        console.error("Failed to load policy:", err);
      });
    }
  }, [policyName]);
  const handleSave = useCallback(async (dryRun = false) => {
    var _a;
    try {
      const result = await editor.save(dryRun);
      if (!dryRun && onSaveSuccess && ((_a = result.metadata) == null ? void 0 : _a.name)) {
        onSaveSuccess(result.metadata.name);
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
  }, [editor, onSaveSuccess]);
  const handleRunPreview = useCallback(() => {
    const policySpec = {
      resource: editor.spec.resource,
      auditRules: editor.spec.auditRules,
      eventRules: editor.spec.eventRules
    };
    const kindLabel = editor.spec.resource.kindLabel || deriveKindLabel(editor.spec.resource.kind);
    const kindLabelPlural = editor.spec.resource.kindLabelPlural || derivePluralLabel(kindLabel);
    preview.runPreview(policySpec, kindLabel, kindLabelPlural).catch((err) => {
      console.error("Preview failed:", err);
    });
  }, [editor.spec, preview]);
  const canSave = editor.name.trim() !== "" && editor.spec.resource.apiGroup.trim() !== "" && editor.spec.resource.kind.trim() !== "";
  return jsxs(Card, { className: `rounded-xl ${className}`, children: [jsxs(CardHeader, { className: "flex flex-row justify-between items-center p-6 border-b border-border space-y-0", children: [jsxs("div", { className: "flex items-center gap-4", children: [editor.isNew ? jsxs("div", { className: "flex flex-col gap-1", children: [jsx(Label$1, { htmlFor: "policy-name", className: "text-xs text-muted-foreground", children: "Policy Name" }), jsx(Input, { id: "policy-name", type: "text", className: "w-[300px] text-base font-medium", value: editor.name, onChange: (e) => editor.setName(e.target.value), placeholder: "e.g., httpproxy-policy" })] }) : jsx("h2", { className: "m-0 text-2xl font-semibold text-foreground", children: editor.name }), editor.isDirty && jsx(Badge, { variant: "warning", children: "Unsaved changes" })] }), jsxs("div", { className: "flex gap-3", children: [onCancel && jsx(Button, { type: "button", variant: "outline", onClick: onCancel, disabled: editor.isSaving, children: "Cancel" }), jsx(Button, { type: "button", variant: "outline", onClick: () => handleSave(true), disabled: !canSave || editor.isSaving, title: "Validate without saving", children: "Validate" }), jsx(Button, { type: "button", onClick: () => handleSave(false), disabled: !canSave || editor.isSaving || !editor.isDirty, className: "bg-[#BF9595] text-[#0C1D31] border-[#BF9595] hover:bg-[#A88080] hover:border-[#A88080]", children: editor.isSaving ? jsxs(Fragment, { children: [jsx("span", { className: "w-3.5 h-3.5 border-2 border-border border-t-[#BF9595] rounded-full animate-spin" }), "Saving..."] }) : "Save Policy" })] })] }), editor.error && jsx(Alert, { variant: "destructive", className: "mx-6 mt-4", children: jsxs(AlertDescription, { children: [jsx("strong", { children: "Error:" }), " ", editor.error.message] }) }), editor.isLoading && jsxs("div", { className: "flex items-center justify-center gap-3 py-12 text-muted-foreground", children: [jsx("span", { className: "w-5 h-5 border-[3px] border-border border-t-[#BF9595] rounded-full animate-spin" }), "Loading policy..."] }), !editor.isLoading && jsxs(CardContent, { className: "grid grid-cols-1 xl:grid-cols-2 gap-6 p-6", children: [jsxs("div", { className: "flex flex-col gap-6", children: [jsx(PolicyResourceForm, { resource: editor.spec.resource, onChange: editor.setResource, client }), jsx(PolicyRuleList, { auditRules: editor.spec.auditRules || [], eventRules: editor.spec.eventRules || [], previewResult: preview.result, onAuditRulesChange: editor.setAuditRules, onEventRulesChange: editor.setEventRules, onAddAuditRule: editor.addAuditRule, onAddEventRule: editor.addEventRule })] }), jsx("div", { className: "sticky top-4 self-start", children: jsx(PolicyPreviewPanel, { inputs: preview.inputs, selectedIndices: preview.selectedIndices, result: preview.result, isLoading: preview.isLoading, error: preview.error, onInputsChange: preview.setInputs, onToggleSelection: preview.toggleSelection, onSelectAll: preview.selectAll, onDeselectAll: preview.deselectAll, onRunPreview: handleRunPreview, onResourceClick, client, policyResource: editor.spec.resource, hasSelection: preview.hasSelection }) })] })] });
}
function deriveKindLabel(kind) {
  if (!kind)
    return "";
  return kind.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}
function derivePluralLabel(label) {
  if (!label)
    return "";
  const trimmed = label.trim();
  if (trimmed.endsWith("y")) {
    return trimmed.slice(0, -1) + "ies";
  } else if (trimmed.endsWith("s") || trimmed.endsWith("x") || trimmed.endsWith("z") || trimmed.endsWith("ch") || trimmed.endsWith("sh")) {
    return trimmed + "es";
  } else {
    return trimmed + "s";
  }
}
[
  {
    name: "Create",
    description: "Resource creation event",
    type: "audit",
    input: {
      type: "audit",
      audit: {
        level: "RequestResponse",
        auditID: "audit-create-001",
        stage: "ResponseComplete",
        requestURI: "/apis/example.com/v1/namespaces/default/examples",
        verb: "create",
        user: {
          username: "alice@example.com",
          uid: "user-alice-123",
          groups: ["users", "developers"]
        },
        objectRef: {
          apiGroup: "example.com",
          apiVersion: "v1",
          resource: "examples",
          namespace: "default",
          name: "my-resource",
          uid: "res-456-789"
        },
        responseStatus: {
          code: 201,
          status: "Success"
        },
        requestReceivedTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        stageTimestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  },
  {
    name: "Update",
    description: "Resource update event (PUT)",
    type: "audit",
    input: {
      type: "audit",
      audit: {
        level: "RequestResponse",
        auditID: "audit-update-001",
        stage: "ResponseComplete",
        requestURI: "/apis/example.com/v1/namespaces/default/examples/my-resource",
        verb: "update",
        user: {
          username: "bob@example.com",
          uid: "user-bob-456",
          groups: ["users", "admins"]
        },
        objectRef: {
          apiGroup: "example.com",
          apiVersion: "v1",
          resource: "examples",
          namespace: "default",
          name: "my-resource",
          uid: "res-456-789"
        },
        responseStatus: {
          code: 200,
          status: "Success"
        },
        requestReceivedTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        stageTimestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  },
  {
    name: "Patch",
    description: "Resource patch event",
    type: "audit",
    input: {
      type: "audit",
      audit: {
        level: "RequestResponse",
        auditID: "audit-patch-001",
        stage: "ResponseComplete",
        requestURI: "/apis/example.com/v1/namespaces/default/examples/my-resource",
        verb: "patch",
        user: {
          username: "carol@example.com",
          uid: "user-carol-789",
          groups: ["users"]
        },
        objectRef: {
          apiGroup: "example.com",
          apiVersion: "v1",
          resource: "examples",
          namespace: "default",
          name: "my-resource",
          uid: "res-456-789"
        },
        responseStatus: {
          code: 200,
          status: "Success"
        },
        requestReceivedTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        stageTimestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  },
  {
    name: "Delete",
    description: "Resource deletion event",
    type: "audit",
    input: {
      type: "audit",
      audit: {
        level: "RequestResponse",
        auditID: "audit-delete-001",
        stage: "ResponseComplete",
        requestURI: "/apis/example.com/v1/namespaces/default/examples/my-resource",
        verb: "delete",
        user: {
          username: "admin@example.com",
          uid: "user-admin-000",
          groups: ["users", "admins", "cluster-admins"]
        },
        objectRef: {
          apiGroup: "example.com",
          apiVersion: "v1",
          resource: "examples",
          namespace: "default",
          name: "my-resource",
          uid: "res-456-789"
        },
        responseStatus: {
          code: 200,
          status: "Success"
        },
        requestReceivedTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        stageTimestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  },
  {
    name: "Status Update",
    description: "Status subresource update",
    type: "audit",
    input: {
      type: "audit",
      audit: {
        level: "RequestResponse",
        auditID: "audit-status-001",
        stage: "ResponseComplete",
        requestURI: "/apis/example.com/v1/namespaces/default/examples/my-resource/status",
        verb: "update",
        user: {
          username: "system:serviceaccount:kube-system:controller-manager",
          uid: "sa-controller-123",
          groups: ["system:serviceaccounts", "system:serviceaccounts:kube-system"]
        },
        objectRef: {
          apiGroup: "example.com",
          apiVersion: "v1",
          resource: "examples",
          subresource: "status",
          namespace: "default",
          name: "my-resource",
          uid: "res-456-789"
        },
        responseStatus: {
          code: 200,
          status: "Success"
        },
        requestReceivedTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        stageTimestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  }
];
[
  {
    name: "Created",
    description: "Resource created successfully",
    type: "event",
    input: {
      type: "event",
      event: {
        type: "Normal",
        reason: "Created",
        message: "Successfully created resource",
        involvedObject: {
          apiVersion: "example.com/v1",
          kind: "Example",
          name: "my-resource",
          namespace: "default",
          uid: "res-456-789"
        },
        source: {
          component: "example-controller"
        },
        firstTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        lastTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        count: 1,
        metadata: {
          name: "my-resource.abc123",
          namespace: "default"
        }
      }
    }
  },
  {
    name: "Ready",
    description: "Resource became ready",
    type: "event",
    input: {
      type: "event",
      event: {
        type: "Normal",
        reason: "Ready",
        message: "Resource is now ready to accept traffic",
        involvedObject: {
          apiVersion: "example.com/v1",
          kind: "Example",
          name: "my-resource",
          namespace: "default",
          uid: "res-456-789"
        },
        source: {
          component: "example-controller"
        },
        firstTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        lastTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        count: 1,
        metadata: {
          name: "my-resource.def456",
          namespace: "default"
        }
      }
    }
  },
  {
    name: "Failed",
    description: "Resource operation failed",
    type: "event",
    input: {
      type: "event",
      event: {
        type: "Warning",
        reason: "Failed",
        message: "Failed to reconcile resource: timeout waiting for backend",
        involvedObject: {
          apiVersion: "example.com/v1",
          kind: "Example",
          name: "my-resource",
          namespace: "default",
          uid: "res-456-789"
        },
        source: {
          component: "example-controller"
        },
        firstTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        lastTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        count: 3,
        metadata: {
          name: "my-resource.ghi789",
          namespace: "default"
        }
      }
    }
  },
  {
    name: "Progressing",
    description: "Resource is progressing",
    type: "event",
    input: {
      type: "event",
      event: {
        type: "Normal",
        reason: "Progressing",
        message: "Resource is being configured",
        involvedObject: {
          apiVersion: "example.com/v1",
          kind: "Example",
          name: "my-resource",
          namespace: "default",
          uid: "res-456-789"
        },
        source: {
          component: "example-controller"
        },
        firstTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        lastTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        count: 1,
        metadata: {
          name: "my-resource.jkl012",
          namespace: "default"
        }
      }
    }
  }
];
class ActivityApiClient {
  constructor(config) {
    this.config = {
      ...config,
      fetch: config.fetch || globalThis.fetch.bind(globalThis)
    };
  }
  /**
   * Create a new AuditLogQuery
   */
  async createQuery(name, spec) {
    const query = {
      apiVersion: "activity.miloapis.com/v1alpha1",
      kind: "AuditLogQuery",
      metadata: { name },
      spec
    };
    const response = await this.fetch("/apis/activity.miloapis.com/v1alpha1/auditlogqueries", {
      method: "POST",
      body: JSON.stringify(query)
    });
    return response.json();
  }
  /**
   * Execute a query and get results with automatic pagination
   */
  async *executeQueryPaginated(spec, options) {
    var _a;
    let pageNum = 0;
    let currentSpec = { ...spec };
    const maxPages = (options == null ? void 0 : options.maxPages) || 100;
    const namePrefix = (options == null ? void 0 : options.queryNamePrefix) || "query";
    while (pageNum < maxPages) {
      const queryName = `${namePrefix}-${Date.now()}-${pageNum}`;
      const result = await this.createQuery(queryName, currentSpec);
      yield result;
      if (!((_a = result.status) == null ? void 0 : _a.continueAfter)) {
        break;
      }
      currentSpec = {
        ...currentSpec,
        continueAfter: result.status.continueAfter
      };
      pageNum++;
    }
  }
  // ============================================
  // Activity API Methods
  // ============================================
  /**
   * List activities with optional filtering and pagination
   */
  async listActivities(params) {
    const searchParams = new URLSearchParams();
    if (params == null ? void 0 : params.filter)
      searchParams.set("filter", params.filter);
    if (params == null ? void 0 : params.fieldSelector)
      searchParams.set("fieldSelector", params.fieldSelector);
    if (params == null ? void 0 : params.labelSelector)
      searchParams.set("labelSelector", params.labelSelector);
    if (params == null ? void 0 : params.search)
      searchParams.set("search", params.search);
    if (params == null ? void 0 : params.start)
      searchParams.set("start", params.start);
    if (params == null ? void 0 : params.end)
      searchParams.set("end", params.end);
    if (params == null ? void 0 : params.changeSource)
      searchParams.set("changeSource", params.changeSource);
    if (params == null ? void 0 : params.limit)
      searchParams.set("limit", String(params.limit));
    if (params == null ? void 0 : params.continue)
      searchParams.set("continue", params.continue);
    const queryString = searchParams.toString();
    const path = `/apis/activity.miloapis.com/v1alpha1/activities${queryString ? `?${queryString}` : ""}`;
    const response = await this.fetch(path);
    return response.json();
  }
  /**
   * Get a specific activity by name
   */
  async getActivity(namespace, name) {
    const response = await this.fetch(`/apis/activity.miloapis.com/v1alpha1/namespaces/${namespace}/activities/${name}`);
    return response.json();
  }
  /**
   * Query facets for filtering UI (autocomplete, distinct values)
   */
  async queryFacets(spec) {
    const query = {
      apiVersion: "activity.miloapis.com/v1alpha1",
      kind: "ActivityFacetQuery",
      spec
    };
    const response = await this.fetch("/apis/activity.miloapis.com/v1alpha1/activityfacetqueries", {
      method: "POST",
      body: JSON.stringify(query)
    });
    return response.json();
  }
  /**
   * List activities with automatic pagination using async generator
   */
  async *listActivitiesPaginated(params, options) {
    var _a;
    let currentParams = { ...params };
    const maxPages = (options == null ? void 0 : options.maxPages) || 100;
    let pageNum = 0;
    while (pageNum < maxPages) {
      const result = await this.listActivities(currentParams);
      yield result;
      if (!((_a = result.metadata) == null ? void 0 : _a.continue)) {
        break;
      }
      currentParams = {
        ...currentParams,
        continue: result.metadata.continue
      };
      pageNum++;
    }
  }
  /**
   * Watch activities in real-time using the Kubernetes watch API.
   * Returns an async generator that yields watch events as they arrive.
   *
   * @param params - Query parameters (filter, start, end, etc.)
   * @param options - Watch options
   * @returns AsyncGenerator of watch events and an abort function
   */
  watchActivities(params, options) {
    const abortController = new AbortController();
    const searchParams = new URLSearchParams();
    searchParams.set("watch", "true");
    if (params == null ? void 0 : params.filter)
      searchParams.set("filter", params.filter);
    if (params == null ? void 0 : params.fieldSelector)
      searchParams.set("fieldSelector", params.fieldSelector);
    if (params == null ? void 0 : params.labelSelector)
      searchParams.set("labelSelector", params.labelSelector);
    if (params == null ? void 0 : params.search)
      searchParams.set("search", params.search);
    if (params == null ? void 0 : params.start)
      searchParams.set("start", params.start);
    if (params == null ? void 0 : params.end)
      searchParams.set("end", params.end);
    if (params == null ? void 0 : params.changeSource)
      searchParams.set("changeSource", params.changeSource);
    if (options == null ? void 0 : options.resourceVersion)
      searchParams.set("resourceVersion", options.resourceVersion);
    const queryString = searchParams.toString();
    const path = `/apis/activity.miloapis.com/v1alpha1/activities?${queryString}`;
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      "Accept": "application/json"
    };
    if (this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }
    const startWatch = async () => {
      var _a, _b, _c, _d;
      try {
        const response = await this.config.fetch(url, {
          headers,
          signal: abortController.signal
        });
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Watch request failed: ${response.status} ${error}`);
        }
        if (!response.body) {
          throw new Error("Response body is not available");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            (_a = options == null ? void 0 : options.onClose) == null ? void 0 : _a.call(options);
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.trim()) {
              try {
                const event = JSON.parse(line);
                (_b = options == null ? void 0 : options.onEvent) == null ? void 0 : _b.call(options, event);
              } catch (parseError) {
                console.warn("Failed to parse watch event:", parseError, line);
              }
            }
          }
        }
      } catch (error) {
        if (error.name === "AbortError") {
          (_c = options == null ? void 0 : options.onClose) == null ? void 0 : _c.call(options);
          return;
        }
        (_d = options == null ? void 0 : options.onError) == null ? void 0 : _d.call(options, error);
      }
    };
    startWatch();
    return {
      stop: () => abortController.abort()
    };
  }
  /**
   * Watch activities using an async generator pattern.
   * This is an alternative API that yields events as they arrive.
   *
   * @param params - Query parameters (filter, start, end, etc.)
   * @param resourceVersion - Resource version to start watching from
   * @returns AsyncGenerator of watch events
   */
  async *watchActivitiesGenerator(params, resourceVersion) {
    const abortController = new AbortController();
    const searchParams = new URLSearchParams();
    searchParams.set("watch", "true");
    if (params == null ? void 0 : params.filter)
      searchParams.set("filter", params.filter);
    if (params == null ? void 0 : params.fieldSelector)
      searchParams.set("fieldSelector", params.fieldSelector);
    if (params == null ? void 0 : params.labelSelector)
      searchParams.set("labelSelector", params.labelSelector);
    if (params == null ? void 0 : params.search)
      searchParams.set("search", params.search);
    if (params == null ? void 0 : params.start)
      searchParams.set("start", params.start);
    if (params == null ? void 0 : params.end)
      searchParams.set("end", params.end);
    if (params == null ? void 0 : params.changeSource)
      searchParams.set("changeSource", params.changeSource);
    if (resourceVersion)
      searchParams.set("resourceVersion", resourceVersion);
    const queryString = searchParams.toString();
    const path = `/apis/activity.miloapis.com/v1alpha1/activities?${queryString}`;
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      "Accept": "application/json"
    };
    if (this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }
    try {
      const response = await this.config.fetch(url, {
        headers,
        signal: abortController.signal
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Watch request failed: ${response.status} ${error}`);
      }
      if (!response.body) {
        throw new Error("Response body is not available");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) {
            const event = JSON.parse(line);
            yield event;
          }
        }
      }
    } finally {
      abortController.abort();
    }
  }
  // ============================================
  // ActivityPolicy API Methods
  // ============================================
  /**
   * List all ActivityPolicies
   */
  async listPolicies() {
    const response = await this.fetch("/apis/activity.miloapis.com/v1alpha1/activitypolicies");
    return response.json();
  }
  /**
   * Get a specific ActivityPolicy by name
   */
  async getPolicy(name) {
    const response = await this.fetch(`/apis/activity.miloapis.com/v1alpha1/activitypolicies/${name}`);
    return response.json();
  }
  /**
   * Create a new ActivityPolicy
   * @param name Policy name
   * @param spec Policy specification
   * @param dryRun If true, validate without persisting
   */
  async createPolicy(name, spec, dryRun) {
    const policy = {
      apiVersion: "activity.miloapis.com/v1alpha1",
      kind: "ActivityPolicy",
      metadata: { name },
      spec
    };
    const searchParams = new URLSearchParams();
    if (dryRun) {
      searchParams.set("dryRun", "All");
    }
    const queryString = searchParams.toString();
    const path = `/apis/activity.miloapis.com/v1alpha1/activitypolicies${queryString ? `?${queryString}` : ""}`;
    const response = await this.fetch(path, {
      method: "POST",
      body: JSON.stringify(policy)
    });
    return response.json();
  }
  /**
   * Update an existing ActivityPolicy
   * @param name Policy name
   * @param spec Policy specification
   * @param dryRun If true, validate without persisting
   * @param resourceVersion Optional resource version for optimistic concurrency
   */
  async updatePolicy(name, spec, dryRun, resourceVersion) {
    const policy = {
      apiVersion: "activity.miloapis.com/v1alpha1",
      kind: "ActivityPolicy",
      metadata: {
        name,
        ...resourceVersion ? { resourceVersion } : {}
      },
      spec
    };
    const searchParams = new URLSearchParams();
    if (dryRun) {
      searchParams.set("dryRun", "All");
    }
    const queryString = searchParams.toString();
    const path = `/apis/activity.miloapis.com/v1alpha1/activitypolicies/${name}${queryString ? `?${queryString}` : ""}`;
    const response = await this.fetch(path, {
      method: "PUT",
      body: JSON.stringify(policy)
    });
    return response.json();
  }
  /**
   * Delete an ActivityPolicy by name
   */
  async deletePolicy(name) {
    await this.fetch(`/apis/activity.miloapis.com/v1alpha1/activitypolicies/${name}`, { method: "DELETE" });
  }
  // ============================================
  // API Discovery Methods
  // ============================================
  /**
   * Discover all API groups available in the cluster
   */
  async discoverAPIGroups() {
    const response = await this.fetch("/apis");
    return response.json();
  }
  /**
   * Discover resources for a specific API group
   */
  async discoverAPIResources(group, version) {
    var _a, _b;
    let apiVersion = version;
    if (!apiVersion) {
      try {
        const groupsResponse = await this.discoverAPIGroups();
        const groupInfo = (_a = groupsResponse.groups) == null ? void 0 : _a.find((g) => g.name === group);
        apiVersion = ((_b = groupInfo == null ? void 0 : groupInfo.preferredVersion) == null ? void 0 : _b.version) || "v1";
      } catch {
        apiVersion = "v1";
      }
    }
    const response = await this.fetch(`/apis/${group}/${apiVersion}`);
    return response.json();
  }
  // ============================================
  // Audit Log Facets API Methods
  // ============================================
  /**
   * Query facets from audit logs (API groups, resources, verbs, etc.)
   * This is an ephemeral resource that executes immediately and returns results.
   */
  async queryAuditLogFacets(spec) {
    const query = {
      apiVersion: "activity.miloapis.com/v1alpha1",
      kind: "AuditLogFacetsQuery",
      spec
    };
    const response = await this.fetch("/apis/activity.miloapis.com/v1alpha1/auditlogfacetsqueries", {
      method: "POST",
      body: JSON.stringify(query)
    });
    return response.json();
  }
  /**
   * Get all API groups that have audit log data
   * Uses the AuditLogFacetsQuery API to discover API groups from actual audit logs.
   */
  async getAuditedAPIGroups() {
    var _a, _b, _c;
    try {
      const result = await this.queryAuditLogFacets({
        timeRange: { start: "now-30d" },
        facets: [{ field: "objectRef.apiGroup", limit: 100 }]
      });
      const apiGroupFacet = (_b = (_a = result.status) == null ? void 0 : _a.facets) == null ? void 0 : _b.find((f) => f.field === "objectRef.apiGroup");
      return ((_c = apiGroupFacet == null ? void 0 : apiGroupFacet.values) == null ? void 0 : _c.map((v) => v.value).filter((v) => v)) || [];
    } catch {
      return [];
    }
  }
  /**
   * Get resource types for an API group that have audit log data
   * Uses the AuditLogFacetsQuery API to discover resources from actual audit logs.
   */
  async getAuditedResources(apiGroup) {
    var _a, _b, _c;
    try {
      const result = await this.queryAuditLogFacets({
        timeRange: { start: "now-30d" },
        filter: `objectRef.apiGroup == "${apiGroup}"`,
        facets: [{ field: "objectRef.resource", limit: 100 }]
      });
      const resourceFacet = (_b = (_a = result.status) == null ? void 0 : _a.facets) == null ? void 0 : _b.find((f) => f.field === "objectRef.resource");
      return ((_c = resourceFacet == null ? void 0 : resourceFacet.values) == null ? void 0 : _c.map((v) => v.value).filter((v) => v)) || [];
    } catch {
      return [];
    }
  }
  // ============================================
  // PolicyPreview API Methods
  // ============================================
  /**
   * Create a PolicyPreview to test a policy against sample input
   * This is a virtual resource that executes immediately and returns results
   */
  async createPolicyPreview(spec) {
    const preview = {
      apiVersion: "activity.miloapis.com/v1alpha1",
      kind: "PolicyPreview",
      spec
    };
    const response = await this.fetch("/apis/activity.miloapis.com/v1alpha1/policypreviews", {
      method: "POST",
      body: JSON.stringify(preview)
    });
    return response.json();
  }
  // ============================================
  // Kubernetes Events API Methods
  // ============================================
  /**
   * List Kubernetes events with optional filtering and pagination
   * Events are stored in ClickHouse and exposed via the Activity API
   */
  async listEvents(params) {
    const searchParams = new URLSearchParams();
    if (params == null ? void 0 : params.fieldSelector)
      searchParams.set("fieldSelector", params.fieldSelector);
    if (params == null ? void 0 : params.labelSelector)
      searchParams.set("labelSelector", params.labelSelector);
    if (params == null ? void 0 : params.limit)
      searchParams.set("limit", String(params.limit));
    if (params == null ? void 0 : params.continue)
      searchParams.set("continue", params.continue);
    if (params == null ? void 0 : params.resourceVersion)
      searchParams.set("resourceVersion", params.resourceVersion);
    const queryString = searchParams.toString();
    let path;
    if (params == null ? void 0 : params.namespace) {
      path = `/apis/activity.miloapis.com/v1alpha1/namespaces/${params.namespace}/events`;
    } else {
      path = `/apis/activity.miloapis.com/v1alpha1/events`;
    }
    if (queryString) {
      path += `?${queryString}`;
    }
    const response = await this.fetch(path);
    return response.json();
  }
  /**
   * Get a specific Kubernetes event by namespace and name
   */
  async getEvent(namespace, name) {
    const response = await this.fetch(`/apis/activity.miloapis.com/v1alpha1/namespaces/${namespace}/events/${name}`);
    return response.json();
  }
  /**
   * List events with automatic pagination using async generator
   */
  async *listEventsPaginated(params, options) {
    var _a;
    let currentParams = { ...params };
    const maxPages = (options == null ? void 0 : options.maxPages) || 100;
    let pageNum = 0;
    while (pageNum < maxPages) {
      const result = await this.listEvents(currentParams);
      yield result;
      if (!((_a = result.metadata) == null ? void 0 : _a.continue)) {
        break;
      }
      currentParams = {
        ...currentParams,
        continue: result.metadata.continue
      };
      pageNum++;
    }
  }
  /**
   * Query facets for Kubernetes events (filter dropdowns, autocomplete)
   * Returns distinct values for fields like involvedObject.kind, reason, type, etc.
   */
  async queryEventFacets(spec) {
    const query = {
      apiVersion: "activity.miloapis.com/v1alpha1",
      kind: "EventFacetQuery",
      spec
    };
    const response = await this.fetch("/apis/activity.miloapis.com/v1alpha1/eventfacetqueries", {
      method: "POST",
      body: JSON.stringify(query)
    });
    return response.json();
  }
  /**
   * Watch Kubernetes events in real-time using the Kubernetes watch API.
   * Returns an async generator that yields watch events as they arrive.
   *
   * @param params - Query parameters (namespace, fieldSelector, etc.)
   * @param options - Watch options
   * @returns Object with stop function to terminate the watch
   */
  watchEvents(params, options) {
    const abortController = new AbortController();
    const searchParams = new URLSearchParams();
    searchParams.set("watch", "true");
    if (params == null ? void 0 : params.fieldSelector)
      searchParams.set("fieldSelector", params.fieldSelector);
    if (params == null ? void 0 : params.labelSelector)
      searchParams.set("labelSelector", params.labelSelector);
    if (options == null ? void 0 : options.resourceVersion)
      searchParams.set("resourceVersion", options.resourceVersion);
    const queryString = searchParams.toString();
    let path;
    if (params == null ? void 0 : params.namespace) {
      path = `/apis/activity.miloapis.com/v1alpha1/namespaces/${params.namespace}/events`;
    } else {
      path = `/apis/activity.miloapis.com/v1alpha1/events`;
    }
    path += `?${queryString}`;
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      "Accept": "application/json"
    };
    if (this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }
    const startWatch = async () => {
      var _a, _b, _c, _d;
      try {
        const response = await this.config.fetch(url, {
          headers,
          signal: abortController.signal
        });
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Watch request failed: ${response.status} ${error}`);
        }
        if (!response.body) {
          throw new Error("Response body is not available");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            (_a = options == null ? void 0 : options.onClose) == null ? void 0 : _a.call(options);
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.trim()) {
              try {
                const event = JSON.parse(line);
                (_b = options == null ? void 0 : options.onEvent) == null ? void 0 : _b.call(options, event);
              } catch (parseError) {
                console.warn("Failed to parse watch event:", parseError, line);
              }
            }
          }
        }
      } catch (error) {
        if (error.name === "AbortError") {
          (_c = options == null ? void 0 : options.onClose) == null ? void 0 : _c.call(options);
          return;
        }
        (_d = options == null ? void 0 : options.onError) == null ? void 0 : _d.call(options, error);
      }
    };
    startWatch();
    return {
      stop: () => abortController.abort()
    };
  }
  async fetch(path, init) {
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      "Content-Type": "application/json",
      ...(init == null ? void 0 : init.headers) || {}
    };
    if (this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }
    const response = await this.config.fetch(url, {
      ...init,
      headers
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} ${error}`);
    }
    return response;
  }
}
function PoliciesEdit() {
  const { client } = useOutletContext();
  const { name } = useParams();
  const navigate = useNavigate();
  const policyName = name ? decodeURIComponent(name) : void 0;
  const handleSaveSuccess = (savedPolicyName) => {
    console.log("Policy updated:", savedPolicyName);
    navigate("/policies");
  };
  const handleCancel = () => {
    navigate("/policies");
  };
  const handleResourceClick = (resource) => {
    alert(
      `Navigate to: ${resource.kind}/${resource.name} in namespace ${resource.namespace || "default"}`
    );
  };
  if (!policyName) {
    return /* @__PURE__ */ jsx("div", { children: "Policy name is required" });
  }
  return /* @__PURE__ */ jsx(
    PolicyEditor,
    {
      client,
      policyName,
      onSaveSuccess: handleSaveSuccess,
      onCancel: handleCancel,
      onResourceClick: handleResourceClick
    }
  );
}
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: PoliciesEdit
}, Symbol.toStringTag, { value: "Module" }));
function AppLayout({ children }) {
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen flex flex-col bg-gradient-to-b from-muted to-muted/80", children: [
    /* @__PURE__ */ jsx("header", { className: "bg-transparent px-8 py-6 text-center", children: /* @__PURE__ */ jsx("div", { className: "text-2xl font-semibold tracking-wider text-foreground", children: "DATUM" }) }),
    /* @__PURE__ */ jsx("main", { className: "flex-1 px-8 py-8 max-w-7xl mx-auto w-full", children }),
    /* @__PURE__ */ jsxs("footer", { className: "bg-gray-800 dark:bg-gray-900 text-white px-8 py-8 text-center mt-auto", children: [
      /* @__PURE__ */ jsxs("p", { className: "my-2", children: [
        "Powered by ",
        /* @__PURE__ */ jsx("strong", { children: "Activity" }),
        " (activity.miloapis.com/v1alpha1)"
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "opacity-80 my-2", children: [
        /* @__PURE__ */ jsx(
          "a",
          {
            href: "https://github.com/datum-cloud/activity",
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-aurora-moss no-underline hover:underline",
            children: "GitHub"
          }
        ),
        " | ",
        /* @__PURE__ */ jsx(
          "a",
          {
            href: "/docs",
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-aurora-moss no-underline hover:underline",
            children: "Documentation"
          }
        )
      ] })
    ] })
  ] });
}
const TABS = [
  { path: "/activity-feed", label: "Activity Feed" },
  { path: "/events", label: "Events" },
  { path: "/resource-history", label: "Resource History" },
  { path: "/audit-logs", label: "Audit Logs" },
  { path: "/policies", label: "Policies", matchPrefix: true }
];
function NavigationToolbar() {
  const location = useLocation();
  const isActive = (tab) => {
    if (tab.matchPrefix) {
      return location.pathname.startsWith(tab.path);
    }
    return location.pathname === tab.path;
  };
  return /* @__PURE__ */ jsx("div", { className: "flex justify-between items-center mb-6 pb-4 border-b", children: /* @__PURE__ */ jsx("div", { className: "flex gap-2", children: TABS.map((tab) => /* @__PURE__ */ jsx(
    Link,
    {
      to: tab.path,
      className: `px-5 py-3 rounded-lg text-sm font-medium border transition-all no-underline ${isActive(tab) ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:border-muted-foreground/30"}`,
      children: tab.label
    },
    tab.path
  )) }) });
}
function EventDetailModal({ title, data, onClose }) {
  return /* @__PURE__ */ jsx(Dialog, { open: true, onOpenChange: (open) => !open && onClose(), children: /* @__PURE__ */ jsxs(DialogContent, { className: "max-w-3xl max-h-[90vh] overflow-hidden flex flex-col", children: [
    /* @__PURE__ */ jsx(DialogHeader, { children: /* @__PURE__ */ jsx(DialogTitle, { children: title }) }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-auto", children: /* @__PURE__ */ jsx("pre", { className: "p-4 bg-muted rounded-md text-sm overflow-x-auto", children: JSON.stringify(data, null, 2) }) })
  ] }) });
}
function ResourceHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [client, setClient] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const initialApiGroup = searchParams.get("apiGroup") || "";
  const initialKind = searchParams.get("kind") || "";
  const initialNamespace = searchParams.get("namespace") || "";
  const initialName = searchParams.get("name") || "";
  const initialUid = searchParams.get("uid") || "";
  const [apiGroup, setApiGroup] = useState(initialApiGroup);
  const [kind, setKind] = useState(initialKind);
  const [namespace, setNamespace] = useState(initialNamespace);
  const [name, setName] = useState(initialName);
  const [uid, setUid] = useState(initialUid);
  const filterFromParams = useMemo(() => {
    if (initialUid) {
      return { uid: initialUid };
    }
    if (initialApiGroup || initialKind || initialNamespace || initialName) {
      const filter = {};
      if (initialApiGroup) filter.apiGroup = initialApiGroup;
      if (initialKind) filter.kind = initialKind;
      if (initialNamespace) filter.namespace = initialNamespace;
      if (initialName) filter.name = initialName;
      return filter;
    }
    return null;
  }, [initialApiGroup, initialKind, initialNamespace, initialName, initialUid]);
  const [submittedFilter, setSubmittedFilter] = useState(filterFromParams);
  useEffect(() => {
    setSubmittedFilter(filterFromParams);
    setApiGroup(initialApiGroup);
    setKind(initialKind);
    setNamespace(initialNamespace);
    setName(initialName);
    setUid(initialUid);
  }, [filterFromParams, initialApiGroup, initialKind, initialNamespace, initialName, initialUid]);
  const isProduction = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
  useEffect(() => {
    if (isProduction) {
      setClient(new ActivityApiClient({ baseUrl: "" }));
    } else {
      const apiUrl = sessionStorage.getItem("apiUrl") || "";
      const token = sessionStorage.getItem("token") || void 0;
      setClient(
        new ActivityApiClient({
          baseUrl: apiUrl || "",
          token
        })
      );
    }
  }, [isProduction]);
  const currentFilters = useMemo(() => {
    const filters = {};
    if (apiGroup) filters.apiGroups = [apiGroup];
    if (kind) filters.resourceKinds = [kind];
    if (namespace) filters.resourceNamespaces = [namespace];
    if (name) filters.resourceName = name;
    return filters;
  }, [apiGroup, kind, namespace, name]);
  const {
    resourceKinds,
    apiGroups,
    resourceNamespaces,
    isLoading: facetsLoading
  } = useFacets(
    client,
    { start: "now-30d" },
    currentFilters
    // Pass current selections to filter facet results
  );
  const apiGroupOptions = useMemo(
    () => apiGroups.filter((f) => f.value).map((f) => ({
      value: f.value,
      label: f.value,
      count: f.count
    })),
    [apiGroups]
  );
  const kindOptions = useMemo(
    () => resourceKinds.filter((f) => f.value).map((f) => ({
      value: f.value,
      label: f.value,
      count: f.count
    })),
    [resourceKinds]
  );
  const namespaceOptions = useMemo(
    () => resourceNamespaces.filter((f) => f.value).map((f) => ({
      value: f.value,
      label: f.value,
      count: f.count
    })),
    [resourceNamespaces]
  );
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const filter = {};
    const params = new URLSearchParams();
    if (uid.trim()) {
      filter.uid = uid.trim();
      params.set("uid", uid.trim());
    } else {
      if (apiGroup) {
        filter.apiGroup = apiGroup;
        params.set("apiGroup", apiGroup);
      }
      if (kind) {
        filter.kind = kind;
        params.set("kind", kind);
      }
      if (namespace) {
        filter.namespace = namespace;
        params.set("namespace", namespace);
      }
      if (name.trim()) {
        filter.name = name.trim();
        params.set("name", name.trim());
      }
    }
    if (Object.keys(filter).length > 0) {
      setSubmittedFilter(filter);
      setSearchParams(params, { replace: false });
    }
  }, [uid, apiGroup, kind, namespace, name, setSearchParams]);
  const handleActivityClick = useCallback((activity) => {
    setSelectedActivity(activity);
  }, []);
  const handleReset = useCallback(() => {
    setSubmittedFilter(null);
    setApiGroup("");
    setKind("");
    setNamespace("");
    setName("");
    setUid("");
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);
  const hasFormData = apiGroup || kind || namespace || name || uid;
  const isUidMode = !!uid;
  const isAttributeMode = !!(apiGroup || kind || namespace || name);
  return /* @__PURE__ */ jsxs(AppLayout, { children: [
    /* @__PURE__ */ jsx(NavigationToolbar, {}),
    !submittedFilter ? /* @__PURE__ */ jsxs(Card, { className: "max-w-2xl mx-auto", children: [
      /* @__PURE__ */ jsxs(CardHeader, { children: [
        /* @__PURE__ */ jsx(CardTitle, { children: "Resource History" }),
        /* @__PURE__ */ jsx(CardDescription, { children: "Search for a resource to view its change history over time" })
      ] }),
      /* @__PURE__ */ jsxs(CardContent, { children: [
        /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-foreground", children: "Search by Resource Attributes" }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                /* @__PURE__ */ jsx(Label$1, { htmlFor: "api-group", children: "API Group" }),
                /* @__PURE__ */ jsx(
                  Combobox,
                  {
                    options: apiGroupOptions,
                    value: apiGroup,
                    onValueChange: setApiGroup,
                    placeholder: "Select API group...",
                    searchPlaceholder: "Search API groups...",
                    emptyMessage: "No API groups found",
                    disabled: isUidMode,
                    loading: facetsLoading && !client,
                    clearable: true,
                    showAllOption: false
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                /* @__PURE__ */ jsx(Label$1, { htmlFor: "kind", children: "Kind" }),
                /* @__PURE__ */ jsx(
                  Combobox,
                  {
                    options: kindOptions,
                    value: kind,
                    onValueChange: setKind,
                    placeholder: "Select kind...",
                    searchPlaceholder: "Search kinds...",
                    emptyMessage: "No kinds found",
                    disabled: isUidMode,
                    loading: facetsLoading && !client,
                    clearable: true,
                    showAllOption: false
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                /* @__PURE__ */ jsx(Label$1, { htmlFor: "namespace", children: "Namespace" }),
                /* @__PURE__ */ jsx(
                  Combobox,
                  {
                    options: namespaceOptions,
                    value: namespace,
                    onValueChange: setNamespace,
                    placeholder: "Select namespace...",
                    searchPlaceholder: "Search namespaces...",
                    emptyMessage: "No namespaces found",
                    disabled: isUidMode,
                    loading: facetsLoading && !client,
                    clearable: true,
                    showAllOption: false
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                /* @__PURE__ */ jsxs(Label$1, { htmlFor: "name", children: [
                  "Name",
                  " ",
                  /* @__PURE__ */ jsx("span", { className: "font-normal text-muted-foreground text-xs", children: "(partial match)" })
                ] }),
                /* @__PURE__ */ jsx(
                  Input,
                  {
                    id: "name",
                    type: "text",
                    value: name,
                    onChange: (e) => setName(e.target.value),
                    placeholder: "e.g., api-gateway",
                    disabled: isUidMode
                  }
                )
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center", children: /* @__PURE__ */ jsx("div", { className: "w-full border-t border-border" }) }),
            /* @__PURE__ */ jsx("div", { className: "relative flex justify-center text-xs uppercase", children: /* @__PURE__ */ jsx("span", { className: "bg-background px-2 text-muted-foreground", children: "or" }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-foreground", children: "Search by Resource UID" }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsx(Label$1, { htmlFor: "uid", children: "Resource UID" }),
              /* @__PURE__ */ jsx(
                Input,
                {
                  id: "uid",
                  type: "text",
                  value: uid,
                  onChange: (e) => setUid(e.target.value),
                  placeholder: "e.g., 550e8400-e29b-41d4-a716-446655440000",
                  className: "font-mono",
                  disabled: isAttributeMode
                }
              ),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "UID provides exact match. When specified, other filters are ignored." })
            ] })
          ] }),
          /* @__PURE__ */ jsx(Button, { type: "submit", disabled: !hasFormData, className: "w-full", children: "View History" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-8 pt-6 border-t", children: [
          /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-foreground mb-3", children: "Tips" }),
          /* @__PURE__ */ jsxs("ul", { className: "space-y-2 text-sm text-muted-foreground list-disc list-inside", children: [
            /* @__PURE__ */ jsxs("li", { children: [
              "Dropdowns ",
              /* @__PURE__ */ jsx("strong", { children: "filter automatically" }),
              " based on other selections"
            ] }),
            /* @__PURE__ */ jsxs("li", { children: [
              /* @__PURE__ */ jsx("strong", { children: "Name" }),
              ' supports partial matching (e.g., "api" matches "api-gateway")'
            ] }),
            /* @__PURE__ */ jsx("li", { children: "Combine filters to narrow down results (e.g., Kind + Namespace)" }),
            /* @__PURE__ */ jsxs("li", { children: [
              "Find a resource's UID with:",
              " ",
              /* @__PURE__ */ jsxs("code", { className: "px-1 py-0.5 bg-muted rounded text-xs", children: [
                "kubectl get <kind> <name> -o jsonpath='",
                "{.metadata.uid}",
                "'"
              ] })
            ] })
          ] })
        ] })
      ] })
    ] }) : /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h1", { className: "text-lg font-semibold text-foreground", children: "Resource History" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: submittedFilter.uid ? /* @__PURE__ */ jsxs("span", { className: "font-mono", children: [
            "UID: ",
            submittedFilter.uid
          ] }) : /* @__PURE__ */ jsx("span", { children: [
            submittedFilter.kind,
            submittedFilter.name,
            submittedFilter.namespace && `in ${submittedFilter.namespace}`,
            submittedFilter.apiGroup && `(${submittedFilter.apiGroup})`
          ].filter(Boolean).join(" ") }) })
        ] }),
        /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: handleReset, children: "New Search" })
      ] }),
      client && /* @__PURE__ */ jsx(
        ResourceHistoryView,
        {
          client,
          resourceFilter: submittedFilter,
          startTime: "now-30d",
          limit: 50,
          showHeader: false,
          compact: false,
          onActivityClick: handleActivityClick
        }
      )
    ] }),
    selectedActivity && /* @__PURE__ */ jsx(
      EventDetailModal,
      {
        title: "Activity Details",
        data: selectedActivity,
        onClose: () => setSelectedActivity(null)
      }
    )
  ] });
}
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: ResourceHistoryPage
}, Symbol.toStringTag, { value: "Module" }));
function PoliciesIndex() {
  const { client } = useOutletContext();
  const navigate = useNavigate();
  const handleCreatePolicy = () => {
    navigate("/policies/new");
  };
  const handleEditPolicy = (policyName) => {
    navigate(`/policies/${encodeURIComponent(policyName)}/edit`);
  };
  return /* @__PURE__ */ jsx(
    PolicyList,
    {
      client,
      onEditPolicy: handleEditPolicy,
      onCreatePolicy: handleCreatePolicy
    }
  );
}
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: PoliciesIndex
}, Symbol.toStringTag, { value: "Module" }));
function ActivityFeedPage() {
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(
    null
  );
  const isProduction = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
  useEffect(() => {
    if (isProduction) {
      setClient(new ActivityApiClient({ baseUrl: "" }));
    } else {
      const apiUrl = sessionStorage.getItem("apiUrl") || "";
      const token = sessionStorage.getItem("token") || void 0;
      setClient(
        new ActivityApiClient({
          baseUrl: apiUrl || "",
          token
        })
      );
    }
  }, [isProduction]);
  const handleActivityClick = (activity) => {
    setSelectedActivity(activity);
  };
  const handleResourceClick = (resource) => {
    const params = new URLSearchParams();
    if (resource.uid) {
      params.set("uid", resource.uid);
    } else {
      if (resource.apiGroup) params.set("apiGroup", resource.apiGroup);
      if (resource.kind) params.set("kind", resource.kind);
      if (resource.namespace) params.set("namespace", resource.namespace);
      if (resource.name) params.set("name", resource.name);
    }
    navigate(`/resource-history?${params.toString()}`);
  };
  return /* @__PURE__ */ jsxs(AppLayout, { children: [
    /* @__PURE__ */ jsx(NavigationToolbar, {}),
    client && /* @__PURE__ */ jsx(
      ActivityFeed,
      {
        client,
        onActivityClick: handleActivityClick,
        onResourceClick: handleResourceClick,
        onCreatePolicy: () => navigate("/policies"),
        initialTimeRange: { start: "now-7d" },
        pageSize: 30,
        showFilters: true,
        infiniteScroll: true,
        enableStreaming: true
      }
    ),
    selectedActivity && /* @__PURE__ */ jsx(
      EventDetailModal,
      {
        title: "Activity Details",
        data: selectedActivity,
        onClose: () => setSelectedActivity(null)
      }
    )
  ] });
}
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: ActivityFeedPage
}, Symbol.toStringTag, { value: "Module" }));
function PoliciesNew() {
  const { client } = useOutletContext();
  const navigate = useNavigate();
  const handleSaveSuccess = (policyName) => {
    console.log("Policy created:", policyName);
    navigate("/policies");
  };
  const handleCancel = () => {
    navigate("/policies");
  };
  const handleResourceClick = (resource) => {
    alert(
      `Navigate to: ${resource.kind}/${resource.name} in namespace ${resource.namespace || "default"}`
    );
  };
  return /* @__PURE__ */ jsx(
    PolicyEditor,
    {
      client,
      onSaveSuccess: handleSaveSuccess,
      onCancel: handleCancel,
      onResourceClick: handleResourceClick
    }
  );
}
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: PoliciesNew
}, Symbol.toStringTag, { value: "Module" }));
function AuditLogsPage() {
  const [client, setClient] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const isProduction = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
  useEffect(() => {
    if (isProduction) {
      setClient(new ActivityApiClient({ baseUrl: "" }));
    } else {
      const apiUrl = sessionStorage.getItem("apiUrl") || "";
      const token = sessionStorage.getItem("token") || void 0;
      setClient(
        new ActivityApiClient({
          baseUrl: apiUrl || "",
          token
        })
      );
    }
  }, [isProduction]);
  const handleEventSelect = (event) => {
    setSelectedEvent(event);
  };
  return /* @__PURE__ */ jsxs(AppLayout, { children: [
    /* @__PURE__ */ jsx(NavigationToolbar, {}),
    client && /* @__PURE__ */ jsx(
      AuditLogQueryComponent,
      {
        client,
        onEventSelect: handleEventSelect,
        initialFilter: 'verb == "delete"',
        initialLimit: 50
      }
    ),
    selectedEvent && /* @__PURE__ */ jsx(
      EventDetailModal,
      {
        title: "Audit Event Details",
        data: selectedEvent,
        onClose: () => setSelectedEvent(null)
      }
    )
  ] });
}
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: AuditLogsPage
}, Symbol.toStringTag, { value: "Module" }));
function PoliciesLayout() {
  const [client, setClient] = useState(null);
  const isProduction = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
  useEffect(() => {
    if (isProduction) {
      setClient(new ActivityApiClient({ baseUrl: "" }));
    } else {
      const apiUrl = sessionStorage.getItem("apiUrl") || "";
      const token = sessionStorage.getItem("token") || void 0;
      setClient(
        new ActivityApiClient({
          baseUrl: apiUrl || "",
          token
        })
      );
    }
  }, [isProduction]);
  return /* @__PURE__ */ jsxs(AppLayout, { children: [
    /* @__PURE__ */ jsx(NavigationToolbar, {}),
    /* @__PURE__ */ jsx("div", { children: client && /* @__PURE__ */ jsx(Outlet, { context: { client } }) })
  ] });
}
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: PoliciesLayout
}, Symbol.toStringTag, { value: "Module" }));
async function loader$3({ request: _request }) {
  if (process.env.NODE_ENV === "production") {
    return redirect("/activity-feed");
  }
  return null;
}
function Index() {
  const [apiUrl, setApiUrl] = useState("");
  const [token, setToken] = useState("");
  const navigate = useNavigate();
  const handleConnect = () => {
    sessionStorage.setItem("apiUrl", apiUrl);
    sessionStorage.setItem("token", token);
    navigate("/activity-feed");
  };
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen flex flex-col bg-gradient-to-b from-muted to-muted/80", children: [
    /* @__PURE__ */ jsx("header", { className: "bg-transparent px-8 py-6 text-center", children: /* @__PURE__ */ jsx("div", { className: "text-2xl font-semibold tracking-wider text-foreground", children: "DATUM" }) }),
    /* @__PURE__ */ jsxs(Card, { className: "max-w-[650px] mx-auto mt-8", children: [
      /* @__PURE__ */ jsxs(CardHeader, { children: [
        /* @__PURE__ */ jsx(CardTitle, { children: "Welcome" }),
        /* @__PURE__ */ jsx(CardDescription, { children: "Connect to Activity to start exploring audit logs and activities" })
      ] }),
      /* @__PURE__ */ jsxs(CardContent, { className: "space-y-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsxs(Label$1, { htmlFor: "api-url", children: [
            "API Server URL",
            " ",
            /* @__PURE__ */ jsx("span", { className: "font-normal text-muted-foreground", children: "(usually proxied through your local machine)" })
          ] }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "api-url",
              type: "text",
              value: apiUrl,
              onChange: (e) => setApiUrl(e.target.value),
              placeholder: "http://localhost:6443",
              className: "bg-muted"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsxs(Label$1, { htmlFor: "token", children: [
            "Bearer Token",
            " ",
            /* @__PURE__ */ jsx("span", { className: "font-normal text-muted-foreground", children: "(optional - leave blank if using client certificates)" })
          ] }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "token",
              type: "password",
              value: token,
              onChange: (e) => setToken(e.target.value),
              placeholder: "Leave blank if not required",
              className: "bg-muted"
            }
          )
        ] }),
        /* @__PURE__ */ jsx(Button, { onClick: handleConnect, className: "w-full", size: "lg", children: "Connect to API" }),
        /* @__PURE__ */ jsxs("div", { className: "pt-6 border-t", children: [
          /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold text-foreground mb-1", children: "What can you do with Activity Explorer?" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mb-4", children: "Here are some common scenarios to get you started:" }),
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "p-5 bg-muted border rounded-lg hover:border-primary hover:-translate-y-0.5 transition-all hover:bg-background hover:shadow-md", children: [
              /* @__PURE__ */ jsx("h4", { className: "text-base font-semibold text-foreground mb-2", children: "Activity Feed" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mb-3", children: "Human-readable activity stream" }),
              /* @__PURE__ */ jsx("code", { className: "block p-2 bg-background border rounded text-xs break-all text-foreground", children: "Filter by human vs system changes" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "p-5 bg-muted border rounded-lg hover:border-primary hover:-translate-y-0.5 transition-all hover:bg-background hover:shadow-md", children: [
              /* @__PURE__ */ jsx("h4", { className: "text-base font-semibold text-foreground mb-2", children: "Security Auditing" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mb-3", children: "Who's accessing your secrets?" }),
              /* @__PURE__ */ jsx("code", { className: "block p-2 bg-background border rounded text-xs break-all text-foreground", children: 'objectRef.resource == "secrets" && verb in ["get", "list"]' })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "p-5 bg-muted border rounded-lg hover:border-primary hover:-translate-y-0.5 transition-all hover:bg-background hover:shadow-md", children: [
              /* @__PURE__ */ jsx("h4", { className: "text-base font-semibold text-foreground mb-2", children: "Compliance" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mb-3", children: "Track deletions in production" }),
              /* @__PURE__ */ jsx("code", { className: "block p-2 bg-background border rounded text-xs break-all text-foreground", children: 'verb == "delete" && objectRef.namespace == "production"' })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "p-5 bg-muted border rounded-lg hover:border-primary hover:-translate-y-0.5 transition-all hover:bg-background hover:shadow-md", children: [
              /* @__PURE__ */ jsx("h4", { className: "text-base font-semibold text-foreground mb-2", children: "Troubleshooting" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mb-3", children: "Find failed pod operations" }),
              /* @__PURE__ */ jsx("code", { className: "block p-2 bg-background border rounded text-xs break-all text-foreground", children: 'objectRef.resource == "pods" && responseStatus.code >= 400' })
            ] })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("footer", { className: "bg-gray-800 text-white px-8 py-8 text-center mt-auto", children: [
      /* @__PURE__ */ jsxs("p", { className: "my-2", children: [
        "Powered by ",
        /* @__PURE__ */ jsx("strong", { children: "Activity" }),
        " (activity.miloapis.com/v1alpha1)"
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "opacity-80 my-2", children: [
        /* @__PURE__ */ jsx(
          "a",
          {
            href: "https://github.com/datum-cloud/activity",
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-[#E6F59F] no-underline hover:underline",
            children: "GitHub"
          }
        ),
        " | ",
        /* @__PURE__ */ jsx(
          "a",
          {
            href: "/docs",
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-[#E6F59F] no-underline hover:underline",
            children: "Documentation"
          }
        )
      ] })
    ] })
  ] });
}
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Index,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
let cachedConfig = null;
function getKubeConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  let apiServerUrl = "https://127.0.0.1:6443";
  let clientCert;
  let clientKey;
  let caCert;
  try {
    const kubeconfigPath = join(process.cwd(), "../../.test-infra/kubeconfig");
    const kubeconfig = load(readFileSync(kubeconfigPath, "utf8"));
    apiServerUrl = kubeconfig.clusters[0].cluster.server;
    const certData = kubeconfig.users[0].user["client-certificate-data"];
    const keyData = kubeconfig.users[0].user["client-key-data"];
    const caData = kubeconfig.clusters[0].cluster["certificate-authority-data"];
    if (certData) clientCert = Buffer.from(certData, "base64");
    if (keyData) clientKey = Buffer.from(keyData, "base64");
    if (caData) caCert = Buffer.from(caData, "base64");
    console.log("✅ Loaded kubeconfig from:", kubeconfigPath);
    console.log("✅ Using Kubernetes API server:", apiServerUrl);
  } catch (e) {
    console.warn("⚠️  Could not read kubeconfig:", e);
  }
  cachedConfig = { apiServerUrl, clientCert, clientKey, caCert };
  return cachedConfig;
}
async function proxyRequest$1(request) {
  const url = new URL(request.url);
  const path = url.pathname + url.search;
  const config = getKubeConfig();
  const targetUrl = new URL(path, config.apiServerUrl);
  const isHttps = targetUrl.protocol === "https:";
  let body;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
  }
  const headers = {};
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== "host" && lowerKey !== "connection") {
      headers[key] = value;
    }
  });
  return new Promise((resolve) => {
    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: request.method,
      headers,
      // Add client certificates for mTLS
      ...isHttps && config.clientCert && config.clientKey ? {
        cert: config.clientCert,
        key: config.clientKey,
        ca: config.caCert,
        rejectUnauthorized: false
      } : {}
    };
    const transport = isHttps ? https : http;
    const proxyReq = transport.request(options, (proxyRes) => {
      const responseHeaders = new Headers();
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (value && key.toLowerCase() !== "transfer-encoding" && key.toLowerCase() !== "connection") {
          responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
      });
      const chunks = [];
      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const responseBody = Buffer.concat(chunks);
        resolve(
          new Response(responseBody, {
            status: proxyRes.statusCode || 500,
            statusText: proxyRes.statusMessage || "Unknown",
            headers: responseHeaders
          })
        );
      });
    });
    proxyReq.on("error", (error) => {
      console.error("Proxy error:", error);
      resolve(
        new Response(
          JSON.stringify({
            error: "Failed to proxy request",
            message: error.message
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
    });
    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
}
async function loader$2({ request }) {
  return proxyRequest$1(request);
}
async function action({ request }) {
  return proxyRequest$1(request);
}
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
function EventsPage() {
  const [client, setClient] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const isProduction = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
  useEffect(() => {
    if (isProduction) {
      setClient(new ActivityApiClient({ baseUrl: "" }));
    } else {
      const apiUrl = sessionStorage.getItem("apiUrl") || "";
      const token = sessionStorage.getItem("token") || void 0;
      setClient(
        new ActivityApiClient({
          baseUrl: apiUrl || "",
          token
        })
      );
    }
  }, [isProduction]);
  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };
  const handleObjectClick = (object) => {
    console.log("Object clicked:", object);
  };
  return /* @__PURE__ */ jsxs(AppLayout, { children: [
    /* @__PURE__ */ jsx(NavigationToolbar, {}),
    /* @__PURE__ */ jsxs("div", { className: "mb-4", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold text-foreground", children: "Kubernetes Events" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mt-1", children: "View Kubernetes events stored in ClickHouse. Filter by type, reason, namespace, and more." })
    ] }),
    client && /* @__PURE__ */ jsx(
      EventsFeed,
      {
        client,
        onEventClick: handleEventClick,
        onObjectClick: handleObjectClick,
        initialTimeRange: { start: "now-24h" },
        pageSize: 50,
        showFilters: true,
        infiniteScroll: true,
        enableStreaming: false
      }
    ),
    selectedEvent && /* @__PURE__ */ jsx(
      EventDetailModal,
      {
        title: "Event Details",
        data: selectedEvent,
        onClose: () => setSelectedEvent(null)
      }
    )
  ] });
}
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: EventsPage
}, Symbol.toStringTag, { value: "Module" }));
async function loader$1({ request: _request }) {
  return new Response("healthy", {
    status: 200,
    headers: {
      "Content-Type": "text/plain"
    }
  });
}
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
async function proxyRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname + url.search;
  const config = getKubeConfig();
  const targetUrl = new URL(path, config.apiServerUrl);
  const isHttps = targetUrl.protocol === "https:";
  const headers = {};
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== "host" && lowerKey !== "connection") {
      headers[key] = value;
    }
  });
  return new Promise((resolve) => {
    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: request.method,
      headers,
      // Add client certificates for mTLS
      ...isHttps && config.clientCert && config.clientKey ? {
        cert: config.clientCert,
        key: config.clientKey,
        ca: config.caCert,
        rejectUnauthorized: false
      } : {}
    };
    const transport = isHttps ? https : http;
    const proxyReq = transport.request(options, (proxyRes) => {
      const responseHeaders = new Headers();
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (value && key.toLowerCase() !== "transfer-encoding" && key.toLowerCase() !== "connection") {
          responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
      });
      const chunks = [];
      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const responseBody = Buffer.concat(chunks);
        resolve(
          new Response(responseBody, {
            status: proxyRes.statusCode || 500,
            statusText: proxyRes.statusMessage || "Unknown",
            headers: responseHeaders
          })
        );
      });
    });
    proxyReq.on("error", (error) => {
      console.error("Proxy error:", error);
      resolve(
        new Response(
          JSON.stringify({
            error: "Failed to proxy request",
            message: error.message
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
    });
    proxyReq.end();
  });
}
async function loader({ request }) {
  return proxyRequest(request);
}
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-bMhjzSxj.js", "imports": ["/assets/index-Cpyx2Kcx.js", "/assets/components-DdpqaNbj.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/root-BPDK2zJg.js", "imports": ["/assets/index-Cpyx2Kcx.js", "/assets/components-DdpqaNbj.js"], "css": [] }, "routes/policies.$name.edit": { "id": "routes/policies.$name.edit", "parentId": "routes/policies", "path": ":name/edit", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/policies._name.edit-COPbLvMd.js", "imports": ["/assets/index-Cpyx2Kcx.js", "/assets/index.esm-BHZ-heAd.js"], "css": [] }, "routes/resource-history": { "id": "routes/resource-history", "parentId": "root", "path": "resource-history", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/resource-history-CjGsBBgN.js", "imports": ["/assets/index-Cpyx2Kcx.js", "/assets/index.esm-BHZ-heAd.js", "/assets/NavigationToolbar-CLBTHe8_.js", "/assets/EventDetailModal-DK6DciOo.js", "/assets/components-DdpqaNbj.js"], "css": [] }, "routes/policies._index": { "id": "routes/policies._index", "parentId": "routes/policies", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/policies._index-Cx4r51Ut.js", "imports": ["/assets/index-Cpyx2Kcx.js", "/assets/index.esm-BHZ-heAd.js"], "css": [] }, "routes/activity-feed": { "id": "routes/activity-feed", "parentId": "root", "path": "activity-feed", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/activity-feed-sV5MD3Q9.js", "imports": ["/assets/index-Cpyx2Kcx.js", "/assets/index.esm-BHZ-heAd.js", "/assets/EventDetailModal-DK6DciOo.js", "/assets/NavigationToolbar-CLBTHe8_.js", "/assets/components-DdpqaNbj.js"], "css": [] }, "routes/policies.new": { "id": "routes/policies.new", "parentId": "routes/policies", "path": "new", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/policies.new-Cl1u12pQ.js", "imports": ["/assets/index-Cpyx2Kcx.js", "/assets/index.esm-BHZ-heAd.js"], "css": [] }, "routes/audit-logs": { "id": "routes/audit-logs", "parentId": "root", "path": "audit-logs", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/audit-logs-BXBL8teH.js", "imports": ["/assets/index-Cpyx2Kcx.js", "/assets/index.esm-BHZ-heAd.js", "/assets/EventDetailModal-DK6DciOo.js", "/assets/NavigationToolbar-CLBTHe8_.js", "/assets/components-DdpqaNbj.js"], "css": [] }, "routes/policies": { "id": "routes/policies", "parentId": "root", "path": "policies", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/policies-npBQHMuB.js", "imports": ["/assets/index-Cpyx2Kcx.js", "/assets/index.esm-BHZ-heAd.js", "/assets/NavigationToolbar-CLBTHe8_.js", "/assets/components-DdpqaNbj.js"], "css": [] }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/_index-E4Lco6i3.js", "imports": ["/assets/index-Cpyx2Kcx.js", "/assets/index.esm-BHZ-heAd.js"], "css": [] }, "routes/apis.$": { "id": "routes/apis.$", "parentId": "routes/apis", "path": "*", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/apis._-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/events": { "id": "routes/events", "parentId": "root", "path": "events", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/events-DRfoWqId.js", "imports": ["/assets/index-Cpyx2Kcx.js", "/assets/index.esm-BHZ-heAd.js", "/assets/EventDetailModal-DK6DciOo.js", "/assets/NavigationToolbar-CLBTHe8_.js", "/assets/components-DdpqaNbj.js"], "css": [] }, "routes/health": { "id": "routes/health", "parentId": "root", "path": "health", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/health-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/apis": { "id": "routes/apis", "parentId": "root", "path": "apis", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/apis-l0sNRNKZ.js", "imports": [], "css": [] } }, "url": "/assets/manifest-56f31ed5.js", "version": "56f31ed5" };
const mode = "production";
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "v3_fetcherPersist": false, "v3_relativeSplatPath": false, "v3_throwAbortReason": false, "v3_routeConfig": false, "v3_singleFetch": false, "v3_lazyRouteDiscovery": false, "unstable_optimizeDeps": false };
const isSpaMode = false;
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/policies.$name.edit": {
    id: "routes/policies.$name.edit",
    parentId: "routes/policies",
    path: ":name/edit",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/resource-history": {
    id: "routes/resource-history",
    parentId: "root",
    path: "resource-history",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/policies._index": {
    id: "routes/policies._index",
    parentId: "routes/policies",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route3
  },
  "routes/activity-feed": {
    id: "routes/activity-feed",
    parentId: "root",
    path: "activity-feed",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/policies.new": {
    id: "routes/policies.new",
    parentId: "routes/policies",
    path: "new",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/audit-logs": {
    id: "routes/audit-logs",
    parentId: "root",
    path: "audit-logs",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/policies": {
    id: "routes/policies",
    parentId: "root",
    path: "policies",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route8
  },
  "routes/apis.$": {
    id: "routes/apis.$",
    parentId: "routes/apis",
    path: "*",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/events": {
    id: "routes/events",
    parentId: "root",
    path: "events",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/health": {
    id: "routes/health",
    parentId: "root",
    path: "health",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "routes/apis": {
    id: "routes/apis",
    parentId: "root",
    path: "apis",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  }
};
export {
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  mode,
  publicPath,
  routes
};
