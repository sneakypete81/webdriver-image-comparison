import scrollToPosition from '../clientSideScripts/scrollToPosition';
import getDocumentScrollHeight from '../clientSideScripts/getDocumentScrollHeight';
import getAndroidStatusAddressToolBarHeight from '../clientSideScripts/getAndroidStatusAddressToolBarHeight';
import getIosStatusAddressToolBarHeight from '../clientSideScripts/getIosStatusAddressToolBarHeight';
import {OFFSETS} from '../helpers/constants';
import {calculateDprData, getScreenshotSize, waitFor} from '../helpers/utils';
import {Executor} from './methods.interface';
import {TakeScreenShot} from './methods.interface';
import {
  FullPageScreenshotOptions,
  FullPageScreenshotNativeMobileOptions,
  FullPageScreenshotDataOptions,
  FullPageScreenshotsData,
} from './screenshots.interfaces';
import {StatusAddressToolBarHeight} from '../clientSideScripts/statusAddressToolBarHeight.interfaces';

/**
 * Take a full page screenshots for desktop / iOS / Android
 */
export async function getBase64FullPageScreenshotsData(
  takeScreenshot: TakeScreenShot,
  executor: Executor,
  options: FullPageScreenshotDataOptions,
): Promise<FullPageScreenshotsData> {
  const {
    addressBarShadowPadding,
    devicePixelRatio,
    fullPageScrollTimeout,
    innerHeight,
    isAndroid,
    isAndroidNativeWebScreenshot,
    isAndroidChromeDriverScreenshot,
    isIos,
    toolBarShadowPadding,
  } = options;
  const desktopOptions = {
    devicePixelRatio,
    fullPageScrollTimeout,
    innerHeight,
  };
  const nativeMobileOptions = {
    ...desktopOptions,
    addressBarShadowPadding,
    toolBarShadowPadding,
  };

  if (isAndroid && isAndroidNativeWebScreenshot) {
    // Create a fullpage screenshot for Android when native screenshot (so including status, address and toolbar) is created
    const {height: statusAddressBarHeight} = (
      <StatusAddressToolBarHeight>(await executor(getAndroidStatusAddressToolBarHeight, OFFSETS.ANDROID))
    ).statusAddressBar;
    const androidNativeMobileOptions = {...nativeMobileOptions, statusAddressBarHeight};

    return getFullPageScreenshotsDataNativeMobile(takeScreenshot, executor, androidNativeMobileOptions);
  } else if (isAndroid && isAndroidChromeDriverScreenshot) {
    const chromeDriverOptions = {devicePixelRatio, fullPageScrollTimeout, innerHeight};

    // Create a fullpage screenshot for Android when the ChromeDriver provides the screenshots
    return getFullPageScreenshotsDataAndroidChromeDriver(takeScreenshot, executor, chromeDriverOptions);
  } else if (isIos) {
    // Create a fullpage screenshot for iOS. iOS screenshots will hold the status, address and toolbar so they need to be removed
    const {height: statusAddressBarHeight} = (
      <StatusAddressToolBarHeight>(await executor(getIosStatusAddressToolBarHeight, OFFSETS.IOS))
    ).statusAddressBar;
    const iosNativeMobileOptions = {...nativeMobileOptions, statusAddressBarHeight};

    return getFullPageScreenshotsDataNativeMobile(takeScreenshot, executor, iosNativeMobileOptions);
  }
  // Create a fullpage screenshot for all desktops
  return getFullPageScreenshotsDataDesktop(takeScreenshot, executor, desktopOptions);
}

/**
 * Take a full page screenshots for native mobile
 */
export async function getFullPageScreenshotsDataNativeMobile(
  takeScreenshot: TakeScreenShot,
  executor: Executor,
  options: FullPageScreenshotNativeMobileOptions,
): Promise<FullPageScreenshotsData> {
  const viewportScreenshots = [];

  // The addressBarShadowPadding and toolBarShadowPadding is used because the viewport has a shadow on the address and the tool bar
  // so the cutout of the vieport needs to be a little bit smaller
  const {
    addressBarShadowPadding,
    devicePixelRatio,
    fullPageScrollTimeout,
    innerHeight,
    statusAddressBarHeight,
    toolBarShadowPadding,
  } = options;
  const iosViewportHeight = innerHeight - addressBarShadowPadding - toolBarShadowPadding;

  // Start with an empty array, during the scroll it will be filled because a page could also have a lazy loading
  const amountOfScrollsArray = [];
  let scrollHeight: number;
  let screenshotSizeWidth: number;

  for (let i = 0; i <= amountOfScrollsArray.length; i++) {
    // Determine and start scrolling
    const scrollY = iosViewportHeight * i;
    await executor(scrollToPosition, scrollY);

    // Simply wait the amount of time specified for lazy-loading
    await waitFor(fullPageScrollTimeout);

    // Take the screenshot and get the width
    const screenshot = await takeBase64Screenshot(takeScreenshot);
    screenshotSizeWidth = getScreenshotSize(screenshot, devicePixelRatio).width;

    // Determine scroll height and check if we need to scroll again
    scrollHeight = await executor(getDocumentScrollHeight);
    if (((scrollY + iosViewportHeight) < scrollHeight)) {
      amountOfScrollsArray.push(amountOfScrollsArray.length);
    }
    // There is no else

    // The height of the image of the last 1 could be different
    const imageHeight = amountOfScrollsArray.length === i ? scrollHeight - scrollY : iosViewportHeight;

    // The starting position for cropping could be different for the last image
    // The cropping always needs to start at status and address bar height and the address bar shadow padding
    const imageYPosition = (amountOfScrollsArray.length === i ? innerHeight - imageHeight : 0) + statusAddressBarHeight + addressBarShadowPadding;

    // Store all the screenshot data in the screenshot object
    viewportScreenshots.push({
      ...calculateDprData({
        canvasWidth: screenshotSizeWidth,
        canvasYPosition: scrollY,
        imageHeight: imageHeight,
        imageWidth: screenshotSizeWidth,
        imageYPosition: imageYPosition,
      }, devicePixelRatio),
      screenshot,
    });
  }

  return {
    ...calculateDprData({
      fullPageHeight: scrollHeight - addressBarShadowPadding - toolBarShadowPadding,
      fullPageWidth: screenshotSizeWidth,
    }, devicePixelRatio),
    data: viewportScreenshots,
  };
}

/**
 * Take a full page screenshot for Android with Chromedriver
 */
export async function getFullPageScreenshotsDataAndroidChromeDriver(
  takeScreenshot: TakeScreenShot,
  executor: Executor,
  options: FullPageScreenshotOptions,
): Promise<FullPageScreenshotsData> {
  const viewportScreenshots = [];
  const {devicePixelRatio, fullPageScrollTimeout, innerHeight} = options;

  // Start with an empty array, during the scroll it will be filled because a page could also have a lazy loading
  const amountOfScrollsArray = [];
  let scrollHeight: number;
  let screenshotSize;

  for (let i = 0; i <= amountOfScrollsArray.length; i++) {
    // Determine and start scrolling
    const scrollY = innerHeight * i;
    await executor(scrollToPosition, scrollY);

    // Simply wait the amount of time specified for lazy-loading
    await waitFor(fullPageScrollTimeout);

    // Take the screenshot
    const screenshot = await takeBase64Screenshot(takeScreenshot);
    screenshotSize = getScreenshotSize(screenshot, devicePixelRatio);

    // Determine scroll height and check if we need to scroll again
    scrollHeight = await executor(getDocumentScrollHeight);
    if ((scrollY + innerHeight) < scrollHeight) {
      amountOfScrollsArray.push(amountOfScrollsArray.length);
    }
    // There is no else

    // The height of the image of the last 1 could be different
    const imageHeight: number = amountOfScrollsArray.length === i ? scrollHeight - (innerHeight * viewportScreenshots.length) : innerHeight;
    // The starting position for cropping could be different for the last image (0 means no cropping)
    const imageYPosition = (amountOfScrollsArray.length === i && amountOfScrollsArray.length !== 0) ? innerHeight - imageHeight : 0;

    // Store all the screenshot data in the screenshot object
    viewportScreenshots.push({
      ...calculateDprData({
        canvasWidth: screenshotSize.width,
        canvasYPosition: scrollY,
        imageHeight: imageHeight,
        imageWidth: screenshotSize.width,
        imageYPosition: imageYPosition,
      }, devicePixelRatio),
      screenshot,
    })
  }

  return {
    ...calculateDprData({
      fullPageHeight: scrollHeight,
      fullPageWidth: screenshotSize.width,
    }, devicePixelRatio),
    data: viewportScreenshots,
  };
}

/**
 * Take a full page screenshots
 */
export async function getFullPageScreenshotsDataDesktop(
  takeScreenshot: TakeScreenShot,
  executor: Executor,
  options: FullPageScreenshotOptions,
): Promise<FullPageScreenshotsData> {
  const viewportScreenshots = [];
  const {devicePixelRatio, fullPageScrollTimeout, innerHeight} = options;

  // Start with an empty array, during the scroll it will be filled because a page could also have a lazy loading
  const amountOfScrollsArray = [];
  let scrollHeight: number;
  let screenshotSize;

  for (let i = 0; i <= amountOfScrollsArray.length; i++) {
    // Determine and start scrolling
    const scrollY = innerHeight * i;
    await executor(scrollToPosition, scrollY);

    // Simply wait the amount of time specified for lazy-loading
    await waitFor(fullPageScrollTimeout);

    // Take the screenshot
    const screenshot = await takeBase64Screenshot(takeScreenshot);
    screenshotSize = getScreenshotSize(screenshot, devicePixelRatio);

    // Determine scroll height and check if we need to scroll again
    scrollHeight = await executor(getDocumentScrollHeight);

    if (((scrollY + innerHeight) < scrollHeight && screenshotSize.height === innerHeight)) {
      amountOfScrollsArray.push(amountOfScrollsArray.length);
    }
    // There is no else, Lazy load and large screenshots,
    // like with older drivers such as FF <= 47 and IE11, will not work

    // The height of the image of the last 1 could be different
    const imageHeight: number = amountOfScrollsArray.length === i
      ? scrollHeight - (innerHeight * viewportScreenshots.length)
      : screenshotSize.height;
    // The starting position for cropping could be different for the last image (0 means no cropping)
    const imageYPosition = (amountOfScrollsArray.length === i && amountOfScrollsArray.length !== 0) ? innerHeight - imageHeight : 0;

    // Store all the screenshot data in the screenshot object
    viewportScreenshots.push({
      ...calculateDprData({
        canvasWidth: screenshotSize.width,
        canvasYPosition: scrollY,
        imageHeight: imageHeight,
        imageWidth: screenshotSize.width,
        imageYPosition: imageYPosition,
      }, devicePixelRatio),
      screenshot,
    });
  }

  return {
    ...calculateDprData({
      fullPageHeight: scrollHeight,
      fullPageWidth: screenshotSize.width,
    }, devicePixelRatio),
    data: viewportScreenshots,
  };
}

/**
 * Take a screenshot
 */
export async function takeBase64Screenshot(takeScreenshot: TakeScreenShot): Promise<string> {
  return takeScreenshot();
}