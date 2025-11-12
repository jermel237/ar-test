import React, { useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import ModuleHeader from "../components/ModuleHeader";
import ProgressBar from "../components/common/ProgressBar";

import Page0 from "../components/Arrays/Page0";
import Page1 from "../components/Arrays/Page1";
import Page2 from "../components/Arrays/Page2";
import Page3 from "../components/Arrays/Page3";
import Page4 from "../components/Arrays/Page4";
import Page5 from "../components/Arrays/Page5";

import { useModuleProgress } from "../services/useModuleProgress";
import { logActivity } from "../services/activityService";
import Page6 from "../components/Arrays/Page6";

const Arrays = () => {
  const navigate = useNavigate();
  const { page } = useParams();

  const pages = [
    <Page0 />,
    <Page1 />,
    <Page2 />,
    <Page3 />,
    <Page4 />,
    <Page5 />,
    // <Page6 />,
  ];
  const totalPages = pages.length;

  //  Convert 1-based URL param to 0-based index
  const pageIndex = Math.min((Number(page) || 1) - 1, totalPages - 1);

  const { currentPage, setCurrentPage, isFinished, finishModule, progress } =
    useModuleProgress("arrays", totalPages);

  // Sync URL param to state + log activity
  useEffect(() => {
    setCurrentPage(pageIndex);

    // Update progress if not finished
    if (!isFinished) {
      setCurrentPage((prev) => {
        if (pageIndex > prev) return pageIndex;
        return prev;
      });

      logActivity("Arrays & Time Complexity");
    }
  }, [pageIndex, setCurrentPage, isFinished]);

  const goNext = () => {
    if (currentPage < totalPages - 1) {
      navigate(`/modules/arrays/${currentPage + 2}`);
    } else {
      finishModule();
      navigate("/modules", { state: { route: "arrays" } });
    }
  };

  const goPrev = () => {
    if (currentPage > 0) {
      navigate(`/modules/arrays/${currentPage}`);
    }
  };

  return (
    <div className="h-[calc(100vh)] overflow-y-auto p-4 bg-base-100 space-y-4">
      <ModuleHeader />
      {/* <ProgressBar progress={progress} /> */}

      {pages[currentPage]}

      <div className="flex justify-between items-center">
        <button
          onClick={goPrev}
          disabled={currentPage === 0}
          className="btn btn-outline"
        >
          Previous
        </button>

        <span className="text-sm font-semibold">
          Page {currentPage + 1} / {totalPages}
        </span>

        {currentPage < totalPages - 1 ? (
          <button onClick={goNext} className="btn btn-primary">
            Next
          </button>
        ) : (
          <button
            onClick={() => {
              finishModule();
              navigate("/modules", { state: { route: "arrays" } });
            }}
            className="btn btn-success flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Finish Module
          </button>
        )}
      </div>
    </div>
  );
};

export default Arrays;
