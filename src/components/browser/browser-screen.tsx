import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurTargetView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { type PopoverTriggerRef } from 'heroui-native';
import type { ComponentRef } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
    Keyboard,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import WebView, { type WebViewMessageEvent, type WebViewNavigation, type WebViewProps } from 'react-native-webview';

import { BrowserGlyph } from './browser-icons';
import { NewTabScreen } from './new-tab-screen';
import { PageAddressBar } from './page-address-bar';
import type { WebsiteColorTarget } from './page-color-controls';
import { RecentTabsScreen } from './recent-tabs-screen';
import { searchProviderUrl, type SearchProvider, type SearchProviderId } from './search-provider-picker';
import type { BrowserTab } from './types';
import { LinkPreviewOverlay, SplitViewPane, WebContextMenu, type PreviewRect, type WebContextAction, type WebContextTarget } from './web-context-actions';

const STORAGE_KEY = 'thermal.browser.tabs.v1';
const SEARCH_ENGINE_KEY = 'thermal.browser.search-engine.v1';
const PAGE_SCALE_SPRING = { damping: 30, stiffness: 220, mass: 1, overshootClamping: true };
type SearchEngine = 'Google' | 'DuckDuckGo' | 'Bing';

function makeWebsiteColorScript(backgroundColor: string | null, textColor: string | null) {
  const background = JSON.stringify(backgroundColor ? safePageColor(backgroundColor) : null);
  const text = JSON.stringify(textColor ? safePageColor(textColor) : null);
  return `(function(){
    var styleId='thermal-website-color-overrides';
    var style=document.getElementById(styleId);
    if(!style){style=document.createElement('style');style.id=styleId;}
    var rules=[];
    if(${background}!==null)rules.push('html,body,body>div,body>main,body>[role="main"],#root,#app,main,article{background-color:'+${background}+'!important}');
    if(${text}!==null)rules.push('body,body *:not(svg):not(path):not(img):not(video):not(canvas),body *:not(svg):not(path):not(img):not(video):not(canvas)::before,body *:not(svg):not(path):not(img):not(video):not(canvas)::after{color:'+${text}+'!important}');
    style.textContent=rules.join('');
    function attachStyle(){
      if(!style.textContent){style.remove();return;}
      var parent=document.head||document.documentElement;
      if(parent&&style.parentNode!==parent)parent.appendChild(style);
    }
    attachStyle();
    if(!window.__thermalColorObserver){
      window.__thermalColorObserver=new MutationObserver(attachStyle);
      window.__thermalColorObserver.observe(document.documentElement,{childList:true,subtree:true});
    }
  })();true;`;
}

const freezePageScript = `
  (function() {
    var state = window.__thermalPausedPageState || { media: [], animations: [], observer: null };
    state.media = [];
    state.animations = document.getAnimations().filter(function(animation) {
      return animation.playState === 'running';
    });
    state.originalMediaPlay = state.originalMediaPlay || HTMLMediaElement.prototype.play;
    function pauseMedia(media) {
      if (!media.paused && state.media.indexOf(media) === -1) state.media.push(media);
      media.pause();
    }
    document.querySelectorAll('audio, video').forEach(pauseMedia);
    state.animations.forEach(function(animation) { animation.pause(); });
    state.style = document.createElement('style');
    state.style.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
    (document.head || document.documentElement).appendChild(state.style);
    HTMLMediaElement.prototype.play = function() { return Promise.resolve(); };
    if (state.observer) state.observer.disconnect();
    state.observer = new MutationObserver(function(records) {
      records.forEach(function(record) {
        record.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('audio, video')) pauseMedia(node);
          if (node.querySelectorAll) node.querySelectorAll('audio, video').forEach(pauseMedia);
        });
      });
    });
    state.observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__thermalPausedPageState = state;
    var root = document.scrollingElement || document.documentElement;
    window.ReactNativeWebView.postMessage('page-frozen:' + root.scrollTop);
  })();
  true;
`;

const resumePageScript = `
  (function() {
    var state = window.__thermalPausedPageState;
    if (!state) return;
    if (state.observer) state.observer.disconnect();
    if (state.originalMediaPlay) HTMLMediaElement.prototype.play = state.originalMediaPlay;
    if (state.style) state.style.remove();
    state.animations.forEach(function(animation) { animation.play(); });
    state.media.forEach(function(media) {
      if (!media.isConnected) return;
      var result = media.play();
      if (result && result.catch) result.catch(function() {});
    });
    delete window.__thermalPausedPageState;
  })();
  true;
`;

const scrollScript = `
  (function() {
    var settleTimer;
    var lastTouchY = 0;
    var edgePull = 0;
    var activeEdge = '';
    var lastColors = '';
    var pinchStartDistance = 0;
    var recentGestureSent = false;
    function resolveColor(value) {
      var probe = document.createElement('span');
      probe.style.color = value || '';
      if (!probe.style.color) return '';
      (document.body || document.documentElement).appendChild(probe);
      var color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }
    function usableBackground(element) {
      if (!element) return '';
      var style = getComputedStyle(element);
      var color = style.backgroundColor;
      if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color;
      var parent = element.parentElement;
      while (parent && parent !== document.documentElement) {
        color = getComputedStyle(parent).backgroundColor;
        if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color;
        parent = parent.parentElement;
      }
      return '';
    }
    function tint(color) {
      var match = color.match(/[\\d.]+/g);
      if (!match || match.length < 3) return 'rgb(248, 249, 250)';
      return 'rgb(' + match.slice(0, 3).map(function(channel) { return Math.round(Number(channel) * 0.12 + 255 * 0.88); }).join(', ') + ')';
    }
    function pageColor() {
      var theme = document.querySelector('meta[name="theme-color"]');
      var themeColor = resolveColor(theme && theme.content ? theme.content.trim() : '') || '#ffffff';
      var candidates = document.querySelectorAll('[class*="hero" i], [id*="hero" i], [class*="banner" i], [id*="banner" i], main section, [role="main"] section, main, [role="main"]');
      var surfaceColor = '';
      for (var index = 0; index < candidates.length; index += 1) {
        surfaceColor = usableBackground(candidates[index]);
        if (surfaceColor) break;
      }
      if (!surfaceColor) surfaceColor = usableBackground(document.body) || usableBackground(document.documentElement);
      surfaceColor = resolveColor(surfaceColor) || tint(themeColor);
      var colors = JSON.stringify({ type: 'page-colors', themeColor: themeColor, surfaceColor: surfaceColor });
      if (colors !== lastColors) {
        lastColors = colors;
        window.ReactNativeWebView.postMessage(colors);
      }
    }
    function scrollPosition() {
      var root = document.scrollingElement || document.documentElement;
      return { top: root.scrollTop, max: Math.max(0, root.scrollHeight - window.innerHeight) };
    }
    function sendPull(distance) {
      edgePull = Math.max(-150, Math.min(150, distance));
      window.ReactNativeWebView.postMessage('edge-pull:' + edgePull);
    }
    window.addEventListener('scroll', function() {
      window.ReactNativeWebView.postMessage('scrolling');
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function() {
        window.ReactNativeWebView.postMessage('scroll-idle');
      }, 640);
    }, { passive: true });
    document.addEventListener('touchstart', function(event) {
      if (event.touches.length === 2) {
        var firstTouch = event.touches[0];
        var secondTouch = event.touches[1];
        var deltaX = secondTouch.clientX - firstTouch.clientX;
        var deltaY = secondTouch.clientY - firstTouch.clientY;
        pinchStartDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        recentGestureSent = false;
        activeEdge = '';
        return;
      }
      if (event.touches.length > 2) return;
      if (!event.touches.length) return;
      lastTouchY = event.touches[0].clientY;
      edgePull = 0;
      activeEdge = '';
    }, { passive: true });
    document.addEventListener('touchmove', function(event) {
      if (event.touches.length >= 2 && pinchStartDistance > 0) {
        var firstTouch = event.touches[0];
        var secondTouch = event.touches[1];
        var deltaX = secondTouch.clientX - firstTouch.clientX;
        var deltaY = secondTouch.clientY - firstTouch.clientY;
        var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (!recentGestureSent && distance < pinchStartDistance * 0.72) {
          recentGestureSent = true;
          window.ReactNativeWebView.postMessage('recent-pinch-out');
        }
        return;
      }
      if (!event.touches.length) return;
      var currentY = event.touches[0].clientY;
      var delta = currentY - lastTouchY;
      lastTouchY = currentY;
      var position = scrollPosition();
      if (!activeEdge && position.top <= 0 && delta > 0) activeEdge = 'top';
      if (!activeEdge && position.top >= position.max - 1 && delta < 0) activeEdge = 'bottom';
      if (!activeEdge) return;
      if (event.cancelable) event.preventDefault();
      sendPull(edgePull + delta * 0.48);
    }, { passive: false });
    function releasePull() {
      if (!activeEdge) return;
      activeEdge = '';
      edgePull = 0;
      window.ReactNativeWebView.postMessage('edge-release');
    }
    var contextTimer = null;
    var contextStart = null;
    var contextTriggered = false;
    var suppressClickUntil = 0;
    function findContextTarget(event) {
      var node = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
      if (!node || !node.closest) return null;
      var image = node.closest('img');
      var anchor = node.closest('a');
      if (node === document.body || node === document.documentElement) return null;
      return { node: node, image: image, anchor: anchor };
    }
    function sendContextTarget(event, target) {
      contextTriggered = true;
      suppressClickUntil = Date.now() + 900;
      window.__thermalContextTarget = target.node;
      window.__thermalRemoveContextTarget = function() {
        if (window.__thermalContextTarget && window.__thermalContextTarget.isConnected) window.__thermalContextTarget.remove();
        window.__thermalContextTarget = null;
      };
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'context-target',
        linkUrl: target.anchor ? target.anchor.href : null,
        imageUrl: target.image ? target.image.currentSrc || target.image.src : null,
        label: target.image ? target.image.alt : (target.anchor.innerText || target.anchor.getAttribute('aria-label') || ''),
        x: event.clientX,
        y: event.clientY
      }));
    }
    function clearContextTimer() {
      if (contextTimer) clearTimeout(contextTimer);
      contextTimer = null;
      contextStart = null;
    }
    document.addEventListener('touchstart', function(event) {
      if (event.touches.length !== 1) return clearContextTimer();
      var target = findContextTarget(event);
      if (!target) return;
      contextTriggered = false;
      contextStart = { x: event.touches[0].clientX, y: event.touches[0].clientY, target: target };
      contextTimer = setTimeout(function() {
        if (contextStart) sendContextTarget({ clientX: contextStart.x, clientY: contextStart.y }, contextStart.target);
      }, 560);
    }, { passive: true, capture: true });
    document.addEventListener('touchmove', function(event) {
      if (!contextStart || !event.touches.length) return;
      var dx = event.touches[0].clientX - contextStart.x;
      var dy = event.touches[0].clientY - contextStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > 12) clearContextTimer();
    }, { passive: true, capture: true });
    document.addEventListener('touchend', function() {
      clearContextTimer();
      if (contextTriggered) setTimeout(function() { contextTriggered = false; }, 900);
    }, { passive: true, capture: true });
    document.addEventListener('touchcancel', clearContextTimer, { passive: true, capture: true });
    document.addEventListener('contextmenu', function(event) {
      var target = findContextTarget(event);
      if (!target) return;
      event.preventDefault();
      if (!contextTriggered) sendContextTarget(event, target);
    }, true);
    document.addEventListener('click', function(event) {
      if (Date.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = 0;
    }, true);
    document.addEventListener('touchend', function(event) {
      if (event.touches.length < 2) {
        pinchStartDistance = 0;
        recentGestureSent = false;
      }
      if (event.touches.length === 0) releasePull();
    }, { passive: true });
    document.addEventListener('touchcancel', function() {
      pinchStartDistance = 0;
      recentGestureSent = false;
      releasePull();
    }, { passive: true });
    pageColor();
    var observer = new MutationObserver(pageColor);
    observer.observe(document.head || document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['content'] });
    observer.observe(document.body || document.documentElement, { subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  })();
  true;
`;

function safePageColor(value: string) {
  const color = value.trim();
  if (/^#[\da-f]{3,4}(?:[\da-f]{3,4})?$/i.test(color)) return color;
  if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)$/i.test(color)) return color;
  return '#FFFFFF';
}

function contrastingText(color: string) {
  const values = color.match(/[\d.]+/g);
  let channels: number[];
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = hex.slice(0, 3).split('').map((part) => part + part).join('');
    channels = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  } else {
    channels = values?.slice(0, 3).map(Number) ?? [255, 255, 255];
  }
  const luminance = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return luminance[0] * 0.2126 + luminance[1] * 0.7152 + luminance[2] * 0.0722 > 0.42 ? '#24282C' : '#FFFFFF';
}

function makeTab(url: string | null = null): BrowserTab {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: url ? getDomain(url) : 'New tab',
    url,
  };
}

function getDomain(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0] || 'New tab';
}

function resolveAddress(input: string, searchEngine: SearchEngine) {
  const value = input.trim();
  if (!value) return null;
  if (/^(https?:\/\/|about:)/i.test(value)) return value;
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([/?#].*)?$/i.test(value)) {
    return `http://${value}`;
  }
  if (/^[^\s.]+\.[^\s]+$/.test(value)) return `https://${value}`;
  const query = encodeURIComponent(value);
  if (searchEngine === 'DuckDuckGo') return `https://duckduckgo.com/?q=${query}`;
  if (searchEngine === 'Bing') return `https://www.bing.com/search?q=${query}`;
  return `https://www.google.com/search?q=${query}`;
}

export function BrowserScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const blurTargetRef = useRef<ComponentRef<typeof View>>(null);
  const webViewRef = useRef<WebView<WebViewProps>>(null);
  const webViewCaptureRef = useRef<ComponentRef<typeof Animated.View>>(null);
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [searchEngine, setSearchEngine] = useState<SearchEngine>('Google');
  const [selectedProvider, setSelectedProvider] = useState<SearchProviderId | null>(null);
  const [isProviderPopoverOpen, setIsProviderPopoverOpen] = useState(false);
  const [providerQuery, setProviderQuery] = useState('');
  const homeAddressInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dockAddressInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const homeProviderTriggerRef = useRef<PopoverTriggerRef>(null);
  const dockProviderTriggerRef = useRef<PopoverTriggerRef>(null);
  const providerAnchorRef = useRef<'home' | 'dock'>('home');
  const [activeColorTarget, setActiveColorTarget] = useState<WebsiteColorTarget>('background');
  const [addressDraft, setAddressDraft] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isTabOverviewOpen, setIsTabOverviewOpen] = useState(false);
  const [isPreviewTransitioning, setIsPreviewTransitioning] = useState(false);
  const [transitionPreview, setTransitionPreview] = useState<string | null>(null);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [contextTarget, setContextTarget] = useState<WebContextTarget | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = useState<{ x: number; y: number } | null>(null);
  const [previewSourceRect, setPreviewSourceRect] = useState<PreviewRect | null>(null);
  const [splitUrl, setSplitUrl] = useState<string | null>(null);
  const [secondPaneAtTop, setSecondPaneAtTop] = useState(false);
  const [pageBarColor, setPageBarColor] = useState('#F3F4F5');
  const [pageSurfaceColor, setPageSurfaceColor] = useState('#FFFFFF');
  const [keyboardTop, setKeyboardTop] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const freezeAcknowledgement = useRef<(() => void) | null>(null);
  const isOpeningOverview = useRef(false);
  const [pillSize, setPillSize] = useState({ width: Math.min(screenWidth - 24, 420), height: 58 });
  const dockX = useSharedValue(Math.max(12, (screenWidth - Math.min(screenWidth - 24, 420)) / 2));
  const dockY = useSharedValue(screenHeight - insets.bottom - 78);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const keyboardTopValue = useSharedValue(0);
  const isDockDragging = useSharedValue(false);
  const pageScale = useSharedValue(1);
  const edgePull = useSharedValue(0);
  const recentScrollX = useSharedValue(0);
  const splitProgress = useSharedValue(0);
  const splitSize = useSharedValue(0.48);
  const captureSequence = useRef(0);
  const pageLoadAcknowledgement = useRef<(() => void) | null>(null);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const hasPage = Boolean(activeTab?.url);
  const pageBarTextColor = contrastingText(pageBarColor);
  const toolbarTextColor = activeTab?.toolbarTextColor ?? pageBarTextColor;
  const toolbarBackgroundColor = activeTab?.toolbarBackgroundColor ?? pageSurfaceColor;
  const recentCardScale = Math.max(0.64, Math.min(0.76, (screenHeight - insets.top - insets.bottom - 150) / screenHeight));
  const tabCardWidth = screenWidth * recentCardScale;
  const tabCardHeight = screenHeight * recentCardScale;
  const recentTabs = activeTab
    ? [activeTab, ...tabs.filter((tab) => tab.id !== activeTab.id)]
    : tabs;

  function handleAddressChange(value: string, anchor: 'home' | 'dock') {
    setAddressDraft(value);
    providerAnchorRef.current = anchor;
    if (value.startsWith('@')) {
      if (selectedProvider) setSelectedProvider(null);
      setProviderQuery(value.slice(1).split(/\s/, 1)[0] ?? '');
      setIsProviderPopoverOpen(true);
      (anchor === 'home' ? homeProviderTriggerRef : dockProviderTriggerRef).current?.open();
      return;
    }
    if (isProviderPopoverOpen) {
      setIsProviderPopoverOpen(false);
      homeProviderTriggerRef.current?.close();
      dockProviderTriggerRef.current?.close();
    }
  }

  function chooseSearchProvider(provider: SearchProvider) {
    const textAfterProvider = addressDraft.startsWith('@')
      ? addressDraft.slice(1).replace(/^\S+\s?/, '')
      : addressDraft;
    setSelectedProvider(provider.id);
    setAddressDraft(textAfterProvider);
    setProviderQuery('');
    setIsProviderPopoverOpen(false);
    homeProviderTriggerRef.current?.close();
    dockProviderTriggerRef.current?.close();
    setTimeout(() => {
      (providerAnchorRef.current === 'home' ? homeAddressInputRef : dockAddressInputRef).current?.focus();
    }, 40);
  }

  function cancelProviderSearch() {
    setAddressDraft((current) => current.startsWith('@') ? current.slice(1) : current);
    setSelectedProvider(null);
    setProviderQuery('');
    setIsProviderPopoverOpen(false);
    homeProviderTriggerRef.current?.close();
    dockProviderTriggerRef.current?.close();
    setTimeout(() => {
      (providerAnchorRef.current === 'home' ? homeAddressInputRef : dockAddressInputRef).current?.focus();
    }, 40);
  }

  useEffect(() => {
    dockX.value = Math.max(12, Math.min(dockX.value, screenWidth - pillSize.width - 12));
    const topY = insets.top + 8;
    const bottomY = keyboardTop > 0
      ? keyboardTop - pillSize.height - 8
      : screenHeight - insets.bottom - pillSize.height - 8;
    const clampedY = Math.max(topY, Math.min(dockY.value, bottomY));
    dockY.value = clampedY - topY < bottomY - clampedY ? topY : bottomY;
  }, [screenHeight, screenWidth, insets.bottom, insets.top, keyboardTop, pillSize.height, pillSize.width, dockX, dockY]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const top = event.endCoordinates.screenY;
      setKeyboardTop(top);
      keyboardTopValue.value = top;
      const bottomY = top - pillSize.height - 8;
      if (dockY.value > bottomY) dockY.value = withSpring(bottomY, { damping: 22, stiffness: 180 });
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardTop(0);
      keyboardTopValue.value = 0;
      const bottomY = screenHeight - insets.bottom - pillSize.height - 8;
      if (dockY.value > screenHeight / 2) dockY.value = withSpring(bottomY, { damping: 22, stiffness: 180 });
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom, keyboardTopValue, pillSize.height, screenHeight, dockY]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!saved || cancelled) return;
        const parsed = JSON.parse(saved) as { tabs?: BrowserTab[]; activeTabId?: string | null };
        if (Array.isArray(parsed.tabs)) setTabs(parsed.tabs);
        if (parsed.activeTabId) setActiveTabId(parsed.activeTabId);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SEARCH_ENGINE_KEY)
      .then((saved) => {
        if (saved === 'Google' || saved === 'DuckDuckGo' || saved === 'Bing') setSearchEngine(saved);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTabId })).catch(() => undefined);
  }, [activeTabId, isReady, tabs]);

  useEffect(() => {
    if (!activeTab) {
      setCanGoBack(false);
      setCanGoForward(false);
      setAddressDraft('');
      return;
    }
    setAddressDraft(activeTab.url ?? '');
    setPageBarColor(safePageColor(activeTab.pageColor ?? '#F3F4F5'));
    setPageSurfaceColor(safePageColor(activeTab.pageSurfaceColor ?? '#FFFFFF'));
    setCanGoBack(false);
    setCanGoForward(false);
    setChromeVisible(true);
  }, [activeTabId]);

  useEffect(() => {
    if (!isTabOverviewOpen) pageScale.value = withSpring(1, PAGE_SCALE_SPRING);
  }, [activeTabId, isTabOverviewOpen, pageScale]);

  function openTab(url: string | null) {
    const tab = makeTab(url);
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setIsTabOverviewOpen(false);
    setIsEditingAddress(false);
    setChromeVisible(true);
    Keyboard.dismiss();
  }

  async function captureCurrentTab(tabId = activeTabId): Promise<string | null> {
    if (!tabId || !webViewCaptureRef.current) return null;
    const sequence = ++captureSequence.current;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 180 + attempt * 180));
      });
      const captureView = webViewCaptureRef.current;
      if (!captureView || sequence !== captureSequence.current) return null;
      try {
        const base64 = await captureRef(captureView, {
          format: 'jpg',
          quality: 0.92,
          result: 'base64',
        });
        if (sequence !== captureSequence.current || tabId !== activeTabId) return null;
        const thumbnail = `data:image/jpeg;base64,${base64}`;
        setTabs((current) => current.map((tab) => tab.id === tabId ? { ...tab, thumbnail } : tab));
        return thumbnail;
      } catch {
        if (attempt === 2) return null;
      }
    }
    return null;
  }

  function finishTabSelection(tabId: string) {
    setActiveTabId(tabId);
    setIsTabOverviewOpen(false);
    setChromeVisible(true);
  }

  async function showRecentTabs() {
    minimizePageToRecentTabs();
  }

  function closeRecentTabs() {
    webViewRef.current?.injectJavaScript(resumePageScript);
    setIsPreviewTransitioning(false);
    setTransitionPreview(null);
    isOpeningOverview.current = false;
    setIsTabOverviewOpen(false);
    setChromeVisible(true);
    recentScrollX.value = 0;
  }

  async function minimizePageToRecentTabs() {
    if (isOpeningOverview.current || isTabOverviewOpen) return;
    isOpeningOverview.current = true;
    Keyboard.dismiss();
    if (webViewRef.current) {
      if (isLoading) {
        await new Promise<void>((resolve) => {
          let timeout: ReturnType<typeof setTimeout>;
          const acknowledgeLoad = () => {
            clearTimeout(timeout);
            if (pageLoadAcknowledgement.current === acknowledgeLoad) pageLoadAcknowledgement.current = null;
            resolve();
          };
          pageLoadAcknowledgement.current = acknowledgeLoad;
          timeout = setTimeout(acknowledgeLoad, 12000);
        });
      }
      const preview = await captureCurrentTab();
      const fallbackPreview = activeTab?.thumbnail;
      if (!preview && !fallbackPreview) {
        isOpeningOverview.current = false;
        setChromeVisible(true);
        return;
      }
      setTransitionPreview(preview ?? fallbackPreview ?? null);
      setIsPreviewTransitioning(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    await new Promise<void>((resolve) => {
      const finishTransition = () => {
        recentScrollX.value = 0;
        setChromeVisible(false);
        setIsTabOverviewOpen(true);
        setIsPreviewTransitioning(false);
        setTransitionPreview(null);
        isOpeningOverview.current = false;
        requestAnimationFrame(() => webViewRef.current?.injectJavaScript(freezePageScript));
        resolve();
      };
      pageScale.value = withSpring(recentCardScale, PAGE_SCALE_SPRING, () => {
        runOnJS(finishTransition)();
      });
    });
  }

  async function returnHome() {
    await captureCurrentTab();
    setActiveTabId(null);
    setChromeVisible(true);
    Keyboard.dismiss();
  }

  function selectRecentTab(tab: BrowserTab) {
    finishTabSelection(tab.id);
  }

  const recentScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      recentScrollX.value = event.contentOffset.x;
    },
  });

  async function submitAddress(value = addressDraft) {
    const url = selectedProvider
      ? searchProviderUrl(value, selectedProvider)
      : resolveAddress(value, searchEngine);
    if (!url) return;
    if (activeTab) {
      await captureCurrentTab(activeTab.id);
      setTabs((current) => current.map((tab) => tab.id === activeTab.id ? { ...tab, title: getDomain(url), url } : tab));
    } else {
      openTab(url);
    }
    setAddressDraft(url);
    setSelectedProvider(null);
    setIsEditingAddress(false);
    Keyboard.dismiss();
  }

  function setWebsiteColor(key: 'websiteBackgroundColor' | 'websiteTextColor', color: string | null) {
    if (!activeTab) return;
    const updatedTab = { ...activeTab, [key]: color ? safePageColor(color) : undefined };
    setTabs((current) => current.map((tab) => tab.id === activeTab.id ? updatedTab : tab));
    webViewRef.current?.injectJavaScript(makeWebsiteColorScript(
      updatedTab.websiteBackgroundColor ?? null,
      updatedTab.websiteTextColor ?? null,
    ));
  }

  function handleNavigationChange(state: WebViewNavigation) {
    setCanGoBack(state.canGoBack);
    setCanGoForward(state.canGoForward);
    if (state.url && state.url !== 'about:blank' && activeTab) {
      setAddressDraft(state.url);
      setTabs((current) => current.map((tab) => tab.id === activeTab.id
        ? { ...tab, url: state.url, title: state.title || getDomain(state.url) }
        : tab));
    }
  }

  function openSplitView(url: string) {
    setSecondPaneAtTop(false);
    splitSize.value = 0.48;
    setSplitUrl(url);
    splitProgress.value = withTiming(1, { duration: 280 });
  }

  function closeSplitView() {
    splitProgress.value = withTiming(0, { duration: 240 }, (finished) => {
      if (finished) runOnJS(setSplitUrl)(null);
    });
  }

  function toggleSplitOrderAndOpen() {
    setSecondPaneAtTop((current) => !current);
    splitProgress.value = withTiming(1, { duration: 220 });
  }

  function swapSplitOrder() {
    splitProgress.value = withTiming(0, { duration: 150 }, (finished) => {
      if (!finished) return;
      runOnJS(toggleSplitOrderAndOpen)();
    });
  }

  function handleWebMessage(event: WebViewMessageEvent) {
    const message = event.nativeEvent.data;
    if (message.startsWith('page-frozen:')) {
      const scrollY = Number(message.slice('page-frozen:'.length));
      if (activeTab && Number.isFinite(scrollY)) {
        setTabs((current) => current.map((tab) => tab.id === activeTab.id ? { ...tab, scrollY } : tab));
      }
      freezeAcknowledgement.current?.();
      return;
    }
    if (message === 'recent-pinch-out') {
      void minimizePageToRecentTabs();
      return;
    }
    if (message.startsWith('edge-pull:')) {
      const distance = Number(message.slice('edge-pull:'.length));
      if (Number.isFinite(distance)) edgePull.value = Math.max(-150, Math.min(150, distance));
      return;
    }
    if (message === 'edge-release') {
      edgePull.value = withSpring(0, { damping: 16, stiffness: 190, mass: 0.72 });
      return;
    }
    if (message.startsWith('{')) {
      try {
        const payload = JSON.parse(message) as {
          type?: string;
          themeColor?: string;
          surfaceColor?: string;
          linkUrl?: string | null;
          imageUrl?: string | null;
          label?: string;
          x?: number;
          y?: number;
        };
        if (payload.type === 'context-target') {
          setContextTarget({
            linkUrl: payload.linkUrl ?? null,
            imageUrl: payload.imageUrl ?? null,
            label: payload.label ?? '',
            x: payload.x ?? screenWidth / 2,
            y: payload.y ?? screenHeight / 2,
          });
          return;
        }
        if (payload.type === 'page-colors') {
          const color = safePageColor(payload.themeColor ?? '#FFFFFF');
          const surfaceColor = safePageColor(payload.surfaceColor ?? '#FFFFFF');
          setPageBarColor(color);
          setPageSurfaceColor(surfaceColor);
          if (activeTab) {
            setTabs((current) => current.map((tab) => tab.id === activeTab.id ? { ...tab, pageColor: color, pageSurfaceColor: surfaceColor } : tab));
          }
        }
      } catch {
        return;
      }
      return;
    }
    if (event.nativeEvent.data === 'scrolling') setChromeVisible(false);
    if (message === 'scroll-idle') {
      setChromeVisible(true);
      void captureCurrentTab();
    }
  }

  async function handleContextAction(action: WebContextAction, menuRect: PreviewRect | null) {
    const target = contextTarget;
    if (!target) return;
    const targetUrl = target.linkUrl ?? target.imageUrl;
    setContextTarget(null);
    if (action === 'open' && targetUrl) {
      openTab(targetUrl);
      return;
    }
    if (action === 'background' && targetUrl) {
      setTabs((current) => [...current, makeTab(targetUrl)]);
      return;
    }
    if (action === 'preview' && targetUrl) {
      setPreviewUrl(targetUrl);
      setPreviewAnchor({ x: target.x, y: target.y });
      setPreviewSourceRect(menuRect);
      return;
    }
    if (action === 'split' && targetUrl) {
      openSplitView(targetUrl);
      return;
    }
    if (action === 'copy' && targetUrl) {
      await Clipboard.setStringAsync(targetUrl);
      return;
    }
    if (action === 'remove') {
      webViewRef.current?.injectJavaScript('window.__thermalRemoveContextTarget&&window.__thermalRemoveContextTarget();true;');
      return;
    }
    if (action === 'download' && target.imageUrl) {
      const extension = target.imageUrl.match(/\.([a-z\d]{2,5})(?:[?#]|$)/i)?.[1]?.toLowerCase() ?? 'jpg';
      const safeExtension = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(extension) ? extension : 'jpg';
      const destination = new File(Paths.document, `thermal-image-${Date.now()}.${safeExtension}`);
      try {
        const task = File.createDownloadTask(target.imageUrl, destination);
        const downloadedFile = await task.downloadAsync();
        if (downloadedFile && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadedFile.uri, { dialogTitle: 'Save or share image', mimeType: downloadedFile.type || `image/${safeExtension}` });
        }
      } catch {
        return;
      }
    }
  }

  const homePinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      if (event.scale < 1) pageScale.value = Math.max(0.78, 1 + (event.scale - 1) * 0.68);
    })
    .onEnd((event) => {
      if (event.scale < 0.82) {
        runOnJS(minimizePageToRecentTabs)();
      } else {
        pageScale.value = withSpring(1, PAGE_SCALE_SPRING);
      }
    });
  const homeMotion = useAnimatedStyle(() => ({
    transform: [{ scale: pageScale.value }],
  }));
  const pageMotion = useAnimatedStyle(() => {
    const cardProgress = Math.max(0, Math.min(1, (1 - pageScale.value) / (1 - recentCardScale)));
    return {
      transform: [
        { translateY: edgePull.value },
        { scale: pageScale.value },
      ],
      borderRadius: cardProgress * 24,
      borderWidth: cardProgress,
      borderColor: '#FFFFFF',
      overflow: 'hidden',
    };
  });
  const splitMainMotion = useAnimatedStyle(() => {
    const paneOffset = (screenHeight * splitSize.value + 12) * splitProgress.value;
    return secondPaneAtTop
      ? { top: paneOffset, bottom: 0 }
      : { top: 0, bottom: paneOffset };
  }, [screenHeight, secondPaneAtTop]);
  const dockGesture = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      isDockDragging.value = true;
      dragStartX.value = dockX.value;
      dragStartY.value = dockY.value;
    })
    .onUpdate((event) => {
      dockX.value = Math.max(12, Math.min(screenWidth - pillSize.width - 12, dragStartX.value + event.translationX));
      const bottomY = keyboardTopValue.value > 0
        ? keyboardTopValue.value - pillSize.height - 8
        : screenHeight - insets.bottom - pillSize.height - 8;
      dockY.value = Math.max(insets.top + 8, Math.min(bottomY, dragStartY.value + event.translationY));
    })
    .onEnd(() => {
      const maxX = screenWidth - pillSize.width - 12;
      const topY = insets.top + 8;
      const bottomY = keyboardTopValue.value > 0
        ? keyboardTopValue.value - pillSize.height - 8
        : screenHeight - insets.bottom - pillSize.height - 8;
      dockX.value = withSpring(dockX.value < maxX / 2 ? 12 : maxX, { damping: 20, stiffness: 175 });
      dockY.value = withSpring(dockY.value - topY < bottomY - dockY.value ? topY : bottomY, { damping: 20, stiffness: 175 });
      isDockDragging.value = false;
    });
  const dockMotion = useAnimatedStyle(() => ({
    left: dockX.value,
    top: dockY.value,
    transform: [{ scale: withSpring(isDockDragging.value ? 1.035 : 1, { damping: 16, stiffness: 210 }) }],
    opacity: withTiming(chromeVisible && !isTabOverviewOpen ? 1 : 0, { duration: chromeVisible && !isTabOverviewOpen ? 240 : 180 }),
  }));
  const safeAreaScript = `(function(){var inset=${Platform.OS === 'android' ? insets.top : 0};function apply(){if(!document.body)return false;var body=document.body;var current=parseFloat(window.getComputedStyle(body).paddingTop)||0;body.style.paddingTop=Math.max(current,inset)+'px';document.documentElement.style.setProperty('--thermal-safe-area-top',inset+'px');return true;}if(!apply()){var timer=setInterval(function(){if(apply())clearInterval(timer);},16);setTimeout(function(){clearInterval(timer);},3000);}})();true;`;

  return (
    <BlurTargetView ref={blurTargetRef} style={[styles.root, isTabOverviewOpen && styles.recentsCanvas]}>
      {hasPage && activeTab?.url ? (
        <Animated.View style={[styles.webViewTrack, splitMainMotion]}>
          <Animated.View
            ref={webViewCaptureRef}
            collapsable={false}
            pointerEvents={isTabOverviewOpen ? 'none' : 'auto'}
            style={[styles.webViewFrame, !isPreviewTransitioning && pageMotion, isTabOverviewOpen && styles.hiddenWebViewFrame, isPreviewTransitioning && styles.previewWebViewHidden]}>
            <WebView<WebViewProps>
              key={activeTab.id}
              ref={webViewRef}
              source={{ uri: activeTab.url }}
              style={styles.webView}
              androidLayerType={Platform.OS === 'android' ? 'software' : undefined}
              onNavigationStateChange={handleNavigationChange}
              onLoadStart={() => {
                setIsLoading(true);
                setChromeVisible(true);
              }}
              onLoadEnd={() => {
                setIsLoading(false);
                pageLoadAcknowledgement.current?.();
                webViewRef.current?.injectJavaScript(makeWebsiteColorScript(
                  activeTab.websiteBackgroundColor ?? null,
                  activeTab.websiteTextColor ?? null,
                ));
                const scrollY = Math.max(0, activeTab.scrollY ?? 0);
                webViewRef.current?.injectJavaScript(`(function(){var target=${scrollY};var attempts=0;function restore(){var root=document.scrollingElement||document.documentElement;root.scrollTop=target;window.scrollTo(0,target);attempts+=1;if(root.scrollTop<target&&attempts<12)setTimeout(restore,150);}restore();})();true;`);
                setTimeout(() => void captureCurrentTab(activeTab.id), 700);
              }}
              onError={() => {
                setIsLoading(false);
                pageLoadAcknowledgement.current?.();
              }}
              onMessage={handleWebMessage}
              injectedJavaScriptBeforeContentLoaded={safeAreaScript}
              injectedJavaScript={scrollScript}
              javaScriptEnabled
              domStorageEnabled
              allowsBackForwardNavigationGestures
              setSupportMultipleWindows={false}
              sharedCookiesEnabled
              originWhitelist={['http://*', 'https://*', 'about:*']}
            />
          </Animated.View>
          {isPreviewTransitioning && transitionPreview ? (
            <Animated.Image
              source={{ uri: transitionPreview }}
              resizeMode="cover"
              pointerEvents="none"
              style={[styles.webViewFrame, pageMotion, styles.transitionPreview]}
            />
          ) : null}
        </Animated.View>
      ) : (
        <GestureDetector gesture={homePinchGesture}>
          <View collapsable={false} style={styles.newTabGestureHost}>
            <NewTabScreen
              motionStyle={homeMotion}
              recentTabs={recentTabs.slice(0, 2)}
              onOpenRecentTabs={() => setIsTabOverviewOpen(true)}
              onSelectRecentTab={selectRecentTab}
              addressDraft={addressDraft}
              onAddressChange={(value) => handleAddressChange(value, 'home')}
              onSubmit={(value) => { void submitAddress(value); }}
              onFocus={() => setIsEditingAddress(true)}
              onBlur={() => setIsEditingAddress(false)}
              addressInputRef={homeAddressInputRef}
              providerId={selectedProvider}
              providerPopoverOpen={isProviderPopoverOpen}
              onProviderPopoverChange={setIsProviderPopoverOpen}
              providerTriggerRef={homeProviderTriggerRef}
              providerQuery={providerQuery}
              onChooseProvider={chooseSearchProvider}
              onCancelProviderSearch={cancelProviderSearch}
            />
          </View>
        </GestureDetector>
      )}

      {hasPage && !splitUrl && (
        <Animated.View
          onLayout={({ nativeEvent }) => setPillSize(nativeEvent.layout)}
          pointerEvents={chromeVisible && !isTabOverviewOpen ? 'auto' : 'none'}
          style={[styles.dockPill, { width: Math.min(screenWidth - 24, 420), backgroundColor: toolbarBackgroundColor, borderColor: pageBarColor }, dockMotion]}>
          <GestureDetector gesture={dockGesture}>
            <View style={styles.pillGrip}>
              <BrowserGlyph name="grip" size={18} color={toolbarTextColor} />
            </View>
          </GestureDetector>
            {activeTab ? (
              <PageAddressBar
                tab={activeTab}
                addressValue={addressDraft}
                isEditing={isEditingAddress}
                isLoading={isLoading}
                toolbarTextColor={toolbarTextColor}
                pageBarColor={pageBarColor}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                selectedProvider={selectedProvider}
                providerPopoverOpen={isProviderPopoverOpen}
                providerQuery={providerQuery}
                providerTriggerRef={dockProviderTriggerRef}
                onCancelProviderSearch={cancelProviderSearch}
                blurTargetRef={blurTargetRef}
                overflowOpen={isOverflowOpen}
                colorTarget={activeColorTarget}
                colorValue={activeColorTarget === 'background'
                  ? activeTab.websiteBackgroundColor ?? activeTab.pageSurfaceColor ?? '#FFFFFF'
                  : activeTab.websiteTextColor ?? pageBarTextColor}
                addressInputRef={dockAddressInputRef}
                onAddressChange={(value) => handleAddressChange(value, 'dock')}
                onFocus={() => setIsEditingAddress(true)}
                onBlur={() => setIsEditingAddress(false)}
                onSubmit={(value) => { void submitAddress(value); }}
                onProviderPopoverChange={setIsProviderPopoverOpen}
                onChooseProvider={chooseSearchProvider}
                onOverflowChange={setIsOverflowOpen}
                onGoBack={() => { setIsOverflowOpen(false); webViewRef.current?.goBack(); }}
                onGoForward={() => { setIsOverflowOpen(false); webViewRef.current?.goForward(); }}
                onRefresh={() => { setIsOverflowOpen(false); webViewRef.current?.reload(); }}
                onColorTargetChange={setActiveColorTarget}
                onColorChange={(color) => setWebsiteColor(activeColorTarget === 'background' ? 'websiteBackgroundColor' : 'websiteTextColor', color)}
                onColorReset={() => setWebsiteColor(activeColorTarget === 'background' ? 'websiteBackgroundColor' : 'websiteTextColor', null)}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${tabs.length} tabs`}
              onPress={() => void showRecentTabs()}
              style={({ pressed }) => [styles.pillTabs, pressed && styles.pressed]}>
              <BrowserGlyph name="panels-top-left" size={17} color={toolbarTextColor} />
              <Text style={[styles.pillTabCount, { color: toolbarTextColor }]}>{tabs.length}</Text>
            </Pressable>
        </Animated.View>
      )}

      {isTabOverviewOpen && (
        <RecentTabsScreen
          tabs={tabs}
          recentTabs={recentTabs}
          screenWidth={screenWidth}
          cardWidth={tabCardWidth}
          cardHeight={tabCardHeight}
          topInset={insets.top}
          bottomInset={insets.bottom}
          onScroll={recentScrollHandler}
          onSelect={selectRecentTab}
          onNewTab={() => openTab(null)}
          onDone={closeRecentTabs}
          onCloseAll={() => { setTabs([]); setActiveTabId(null); setIsTabOverviewOpen(false); }}
        />
      )}
      {contextTarget ? (
        <WebContextMenu
          target={contextTarget}
          onAction={(action, menuRect) => { void handleContextAction(action, menuRect); }}
          onDismiss={() => setContextTarget(null)}
        />
      ) : null}
      <LinkPreviewOverlay
        uri={previewUrl}
        anchor={previewAnchor}
        sourceRect={previewSourceRect}
        onClose={() => { setPreviewUrl(null); setPreviewAnchor(null); setPreviewSourceRect(null); }}
      />
      {splitUrl ? (
        <SplitViewPane
          uri={splitUrl}
          progress={splitProgress}
          size={splitSize}
          secondAtTop={secondPaneAtTop}
          onSwapOrder={swapSplitOrder}
          onClose={closeSplitView}
        />
      ) : null}
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  recentsCanvas: { backgroundColor: '#F2F3F4' },
  webViewTrack: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  webViewFrame: { ...StyleSheet.absoluteFill, backgroundColor: '#FFFFFF' },
  hiddenWebViewFrame: { opacity: 0 },
  previewWebViewHidden: { opacity: 0 },
  transitionPreview: { zIndex: 2, borderRadius: 24, overflow: 'hidden' },
  webView: { ...StyleSheet.absoluteFill, backgroundColor: '#FFFFFF' },
  pressed: { opacity: 0.68 },
  newTabGestureHost: { flex: 1 },
  dockPill: { position: 'absolute', minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, borderRadius: 32, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E6E8', shadowColor: '#101820', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 20, zIndex: 20 },
  pillGrip: { width: 29, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'transparent' },
  pillTabs: { width: 46, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 23 },
  pillTabCount: { color: '#444A4F', fontSize: 11, fontWeight: '700' },
});