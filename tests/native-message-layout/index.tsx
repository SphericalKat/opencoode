import { FlashList } from "@shopify/flash-list";
import type { FlashListRef } from "@shopify/flash-list";
import { registerRootComponent } from "expo";
import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { Markdown } from "../../src/components/markdown";
import { UserMessageBubble } from "../../src/components/user-message-bubble";
import { BetaLayoutContext } from "../../src/lib/beta-layout";
import { ThemeProvider } from "../../src/lib/theme";

const text = `Initial set of feedback:

1. add a header that says "Latest models" in a row with a refresh button on the right
2. The loading state can be made simpler, just show a circular progress loader
3. Make the widget always respect the system light/dark theme with the default color scheme but if dynamic color color is enabled then pull colors from the wallpaper.`;
interface Item {
  id: string;
  target?: boolean;
  variant?: "short" | "attachment";
}
type ProbeGlobal = typeof globalThis & { repro45Measure?: () => void };
const fillers = Array.from({ length: 35 }, (_, i) => ({ id: `filler-${i}` }));
function Demo() {
  const [items, setItems] = useState<Item[]>([
    { id: "initial", target: true },
    ...fillers,
  ]);
  const [beta, setBeta] = useState(true);
  const [width, setWidth] = useState(393);
  const list = useRef<FlashListRef<Item>>(null);
  const next = useRef<React.ComponentRef<typeof View>>(null);
  const offset = useRef(0);
  const attachment = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    let cancelled = false;
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const measure = async (w: number, b: boolean, phase: string) => {
      console.log(
        "REPRO45_CASE",
        JSON.stringify({ b, offset: offset.current, phase, w })
      );
      (globalThis as ProbeGlobal).repro45Measure?.();
      if (phase === "attachment") {
        attachment.current?.measureInWindow((x, y, w, h) =>
          console.log("REPRO45_ATTACHMENT", JSON.stringify({ h, w, x, y }))
        );
      }
      next.current?.measureInWindow((x, y, w, h) =>
        console.log("REPRO45_NEXT", JSON.stringify({ h, w, x, y }))
      );
      await delay(500);
    };
    (async () => {
      for (const b of [true, false]) {
        for (const w of [393, 360, 320]) {
          if (cancelled) {
            return;
          }
          setWidth(w);
          setBeta(b);
          setItems([{ id: `initial-${w}-${b}`, target: true }, ...fillers]);
          list.current?.scrollToOffset({ animated: false, offset: 0 });
          await delay(1200);
          await measure(w, b, "initial");
          setItems((previous) => [
            ...previous,
            { id: `sent-${w}-${b}`, target: true },
            { id: "following" },
          ]);
          await delay(700);
          list.current?.scrollToEnd({ animated: false });
          await delay(1200);
          await measure(w, b, "send");
          list.current?.scrollToOffset({ animated: false, offset: 0 });
          await delay(1200);
          console.log(
            "REPRO45_AWAY",
            JSON.stringify({ b, offset: offset.current, w })
          );
          list.current?.scrollToEnd({ animated: false });
          await delay(1200);
          await measure(w, b, "scroll");
        }
      }
      for (const variant of ["short", "attachment"] as const) {
        setWidth(393);
        setBeta(true);
        setItems([{ id: variant, target: true, variant }, ...fillers]);
        list.current?.scrollToOffset({ animated: false, offset: 0 });
        await delay(1200);
        await measure(393, true, variant);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <BetaLayoutContext.Provider value={beta}>
      <ThemeProvider>
        <View
          style={{
            backgroundColor: "#171717",
            height: 700,
            padding: 16,
            width,
          }}
        >
          <FlashList
            ref={list}
            onScroll={(event) => {
              offset.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            data={items}
            keyExtractor={(item) => item.id}
            getItemType={(item) => (item.target ? "message" : "filler")}
            renderItem={({ item, index }) =>
              item.target ? (
                <UserMessageBubble
                  withAttachments={item.variant === "attachment"}
                >
                  <Markdown text={item.variant ? "A short message" : text} />
                  {item.variant === "attachment" && (
                    <View
                      ref={attachment}
                      style={{
                        backgroundColor: "#555",
                        height: 80,
                        width: "100%",
                      }}
                    >
                      <Text>Attached image</Text>
                    </View>
                  )}
                </UserMessageBubble>
              ) : (
                <View
                  ref={
                    item.id === "following" ||
                    (index === 1 && items.length === 36)
                      ? next
                      : undefined
                  }
                  style={{ height: 64, marginTop: 16 }}
                >
                  <Text>Following transcript item</Text>
                </View>
              )
            }
          />
        </View>
      </ThemeProvider>
    </BetaLayoutContext.Provider>
  );
}
registerRootComponent(Demo);
