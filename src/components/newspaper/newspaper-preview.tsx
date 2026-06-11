import React from "react";

interface NewspaperPreviewProps {
  weekNumber: number;
  headline: string;
  dateline: string;
  bodyText: string;
  caption: string;
  closingText: string;
  photos: string[];
}

export const NewspaperPreview = React.forwardRef<HTMLDivElement, NewspaperPreviewProps>(
  ({ weekNumber, headline, dateline, bodyText, caption, closingText, photos }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: "800px",
          minHeight: "1100px",
          backgroundColor: "#f5f0e8",
          color: "#1a1a1a",
          fontFamily: "'EB Garamond', Georgia, serif",
          padding: "24px",
          border: "3px solid #1a1a1a",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {/* Masthead */}
        <div
          style={{
            borderBottom: "3px solid #1a1a1a",
            paddingBottom: "8px",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "2px", fontFamily: "Georgia, serif" }}>
            Championship Edition
          </span>
          <span
            style={{
              fontFamily: "'UnifrakturMaguntia', 'MedievalSharp', 'Palatino Linotype', Georgia, serif",
              fontSize: "42px",
              fontWeight: "bold",
              letterSpacing: "1px",
              lineHeight: 1,
            }}
          >
            Dieppe DGC
          </span>
          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "2px", fontFamily: "Georgia, serif" }}>
            Mondays 6PM
          </span>
        </div>

        {/* League name */}
        <div
          style={{
            textAlign: "center",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "3px",
            borderBottom: "1px solid #1a1a1a",
            paddingBottom: "6px",
            marginBottom: "10px",
            fontFamily: "Georgia, serif",
          }}
        >
          ADG Dieppe Disc Golf Mixed Summer League
        </div>

        {/* Main headline */}
        <div
          style={{
            textAlign: "center",
            fontFamily: "'Playfair Display', 'Times New Roman', Georgia, serif",
            fontSize: "52px",
            fontWeight: "900",
            lineHeight: 1,
            marginBottom: "12px",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          {headline}
        </div>

        <div
          style={{
            borderTop: "3px solid #1a1a1a",
            borderBottom: "1px solid #1a1a1a",
            height: "4px",
            marginBottom: "12px",
          }}
        />

        {/* Two-column body */}
        <div style={{ display: "flex", gap: "20px", flex: 1 }}>
          {/* Left column — photos */}
          <div style={{ width: "310px", flexShrink: 0 }}>
            {photos.length > 0 ? (
              photos.map((url, i) => (
                <div key={i} style={{ marginBottom: "8px" }}>
                  <img
                    src={url}
                    alt=""
                    style={{
                      width: "100%",
                      display: "block",
                      filter: "grayscale(30%)",
                      border: "1px solid #555",
                    }}
                  />
                </div>
              ))
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "240px",
                  backgroundColor: "#d8d0c0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  color: "#888",
                  border: "1px dashed #aaa",
                  fontStyle: "italic",
                }}
              >
                Photo goes here
              </div>
            )}
            {caption && (
              <p
                style={{
                  fontSize: "11px",
                  fontStyle: "italic",
                  color: "#444",
                  marginTop: "4px",
                  lineHeight: 1.4,
                  fontFamily: "Georgia, serif",
                }}
              >
                {caption}
              </p>
            )}
          </div>

          {/* Column divider */}
          <div style={{ width: "1px", backgroundColor: "#1a1a1a", flexShrink: 0 }} />

          {/* Right column — text */}
          <div style={{ flex: 1 }}>
            {dateline && (
              <p
                style={{
                  fontSize: "13px",
                  marginBottom: "10px",
                  lineHeight: 1.5,
                  fontFamily: "Georgia, serif",
                }}
              >
                {dateline}
              </p>
            )}
            <div
              style={{
                fontSize: "13px",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                fontFamily: "Georgia, serif",
              }}
            >
              {bodyText}
            </div>

            {closingText && (
              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "10px",
                  borderTop: "1px solid #aaa",
                  fontSize: "11px",
                  color: "#444",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                  fontFamily: "Georgia, serif",
                }}
              >
                {closingText}
              </div>
            )}

            {/* Atlantic Disc Golf sponsor block */}
            <div
              style={{
                marginTop: "24px",
                paddingTop: "12px",
                borderTop: "2px solid #1a1a1a",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  backgroundColor: "#1a1a1a",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f5f0e8",
                  fontSize: "20px",
                }}
              >
                🥏
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "14px", fontWeight: "bold" }}>
                  Atlantic Disc Golf
                </div>
                <div style={{ fontSize: "11px", color: "#555" }}>Proud sponsor of the ADGDDGMSL</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

NewspaperPreview.displayName = "NewspaperPreview";
